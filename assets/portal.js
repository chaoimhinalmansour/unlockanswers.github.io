"use strict";

(function () {
  const session = window.UnlockSession;
  const writingWorkspace = window.UnlockWritingWorkspace;
  const { setLabel } = window.UnlockStudentUI;
  const expectedTeacher = "1f81fc017f9006f147330dd5e9072b98074791e9e759d3fbddfc16cab073950d";
  const form = document.getElementById("login-form");
  const login = document.getElementById("login");
  const workspace = document.getElementById("workspace");
  const header = document.querySelector(".portal-header");
  const account = document.getElementById("portal-account");
  const portraits = document.getElementById("student-portraits");
  const password = document.getElementById("login-password");
  const message = document.getElementById("login-message");
  const submit = form.querySelector('button[type="submit"]');
  const params = new URLSearchParams(location.search);
  const requestedRole = params.get("role");
  const next = params.get("next");
  const roster = window.UNLOCK_STUDENTS || [];
  const writingEntry = "20261124-teacher-workspace";
  const writing = { title: "写作复盘", text: "查看原文批注、评分和讲评。", url: "writing-review.html" };
  const cards = {
    student: [
      { english: "Classroom", title: "单元课堂", description: "In-class exercises by unit.", text: "各单元的课堂练习。", url: "classroom/index.html" },
      { english: "Unit Practice", title: "单元练习", description: "After-class assignments by unit.", text: "各单元的课后任务。", url: "practice/index.html" },
      { ...writing, english: "Writing Review", description: "Read annotated drafts and feedback.", text: "查看原文批注和讲评。" }
    ],
    teacher: [
      { title: "教学与讲评", text: "按册、单元和科目查看答案与解析。", url: "practice/teaching.html" },
      { title: "课堂反馈", text: "按课次记录学生表现并导出 PDF。", url: "feedback/index.html" },
      writing,
      { title: "课堂课件", text: "选好册次和课节后，直接打开课堂画面。", url: "courseware/index.html?view=classroom" },
      { title: "课件后台", text: "按册次和课节查看活动目录、课件及配套材料。", url: "courseware/index.html?view=backstage" }
    ]
  };

  function englishName(person) {
    return person?.name.match(/（([^）]+)）$/)?.[1];
  }

  function portraitOption(person, index) {
    const option = document.createElement("div");
    option.className = "portrait-option";
    option.dataset.portraitSlot = String(person.loginPortrait ?? index + 1);
    const name = englishName(person) || person.name;
    const choice = document.createElement("input");
    choice.className = "portrait-hit visually-hidden";
    choice.id = "portrait-choice-" + (index + 1);
    choice.type = "checkbox";
    choice.name = "student";
    choice.value = person.name;
    choice.setAttribute("aria-label", name);
    const target = document.createElement("label");
    target.className = "portrait-target";
    target.htmlFor = choice.id;
    const caption = document.createElement("span");
    caption.className = "portrait-name";
    caption.lang = "en";
    caption.textContent = name;
    caption.setAttribute("aria-hidden", "true");
    option.append(choice, target, caption);
    return option;
  }

  portraits.replaceChildren(...roster.map(portraitOption));

  function selectedName() {
    return form.querySelector('input[name="student"]:checked')?.value;
  }

  function showMessage(english, chinese) {
    setLabel(message, english, chinese);
    if (!english) password.removeAttribute("aria-invalid");
  }

  function showWorkspaceNotice(english, chinese) {
    const notice = document.getElementById("workspace-notice");
    setLabel(notice, english, chinese);
    notice.hidden = !english;
  }

  function isReviewTarget(target) {
    return target?.pathname.endsWith("/" + writing.url);
  }

  function requiresTeacherGrant(active) {
    return active?.role === "teacher" && isReviewTarget(session.destination(next, "teacher")) &&
      !writingWorkspace.currentTicket();
  }

  function workspaceCard(item, role, canOpenWriting) {
    const card = document.createElement("a");
    card.className = "workspace-card";
    card.href = item.url;
    if (item.url === writing.url) {
      const review = item.url + "?entry=" + writingEntry;
      if (canOpenWriting) card.href = review;
      else if (role === "teacher") card.href = writingWorkspace.teacherSignInUrl(review);
    }
    if (item.url === writing.url && role === "student" && !canOpenWriting) {
      card.addEventListener("click", event => {
        event.preventDefault();
        showWorkspaceNotice("Sign in to UNLOCK with your personal link to open Writing Review.",
                            "请用你的个人登录链接进入 UNLOCK，再点「写作复盘」。");
      });
    }
    const title = document.createElement("h2");
    const text = document.createElement("p");
    if (item.english) {
      setLabel(title, item.english, item.title);
      setLabel(text, item.description, item.text);
    } else {
      title.textContent = item.title;
      text.textContent = item.text;
    }
    card.append(title, text);
    return card;
  }

  let personalLogin;

  function render() {
    if (personalLogin) return;
    const active = session.current();
    const person = session.student(active);
    if (active?.role === "student" && !person) {
      session.signOut("student", next);
      return;
    }
    const renewingTeacher = requiresTeacherGrant(active);
    if (active && !renewingTeacher) {
      const returnTo = session.destination(next, active.role);
      if (returnTo) {
        location.replace(returnTo);
        return;
      }
      const teacher = active.role === "teacher";
      login.hidden = true;
      workspace.hidden = false;
      header.hidden = false;
      account.hidden = false;
      const writingTicket = writingWorkspace?.currentTicket();
      document.getElementById("account-name").textContent = teacher ? "教师" : writingTicket?.viewer.name || person.name;
      workspace.dataset.role = active.role;
      const title = document.getElementById("workspace-title");
      if (teacher) title.textContent = "教师工作区";
      else setLabel(title, "Student Workspace", "学生工作区");
      document.getElementById("workspace-cards").replaceChildren(...cards[active.role].map(
        item => workspaceCard(item, active.role, Boolean(writingTicket))
      ));
      const otherRole = /^(student|teacher)$/.test(requestedRole) && requestedRole !== active.role;
      const needsTeacher = requestedRole === "teacher";
      showWorkspaceNotice(otherRole ? "Sign out to use a " + (needsTeacher ? "teacher" : "student") + " account." : "",
        "请退出当前账号后以" + (needsTeacher ? "教师" : "学生") + "身份登录。");
      document.title = (teacher ? "教师工作区" : "Student Workspace") + " | UNLOCK";
    } else {
      workspace.hidden = true;
      header.hidden = true;
      account.hidden = true;
      login.hidden = false;
      form.reset();
      if (renewingTeacher) {
        showMessage("Sign in again with the teacher password to open Writing Review.",
                    "请用教师密码重新登录一次，即可打开写作复盘。");
      } else showMessage("");
    }
  }

  form.addEventListener("change", event => {
    const selected = event.target;
    if (selected.name !== "student") return;
    for (const choice of portraits.querySelectorAll(".portrait-hit:checked")) {
      if (choice !== selected) choice.checked = false;
    }
    showMessage("");
  });
  password.addEventListener("input", () => showMessage(""));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const activeAtStart = session.current();
    const renewingTeacher = requiresTeacherGrant(activeAtStart);
    if (activeAtStart && !renewingTeacher) return;
    const name = selectedName();
    const entered = password.value;
    submit.disabled = true;
    showMessage("");
    try {
      const teacher = await session.matchesPassword(entered, expectedTeacher);
      if (personalLogin || name !== selectedName() || entered !== password.value || session.current()?.id !== activeAtStart?.id) return;
      const person = teacher ? undefined : roster.find(item => item.name === name);
      const studentPassword = englishName(person);
      if (!teacher && (renewingTeacher || !studentPassword || entered.trim() !== studentPassword)) {
        showMessage(
          renewingTeacher ? "Check the teacher password." :
            person ? "Check your selected portrait and password." : "Students, select a portrait. Teachers, check your password.",
          renewingTeacher ? "请检查教师密码。" :
            person ? "请检查所选人物和英文名密码。" : "学生请先选人物，教师请检查密码。" 
        );
        password.setAttribute("aria-invalid", "true");
        password.focus();
        password.select();
        return;
      }
      const role = teacher ? "teacher" : "student";
      let teacherWriting;
      if (teacher) {
        try {
          teacherWriting = await writingWorkspace.openTeacherGrant(entered);
        } catch {
          if (isReviewTarget(session.destination(next, role))) {
            showMessage("Writing Review is temporarily unavailable. Please try again.",
                        "暂时无法打开写作复盘，请稍后重试。");
            return;
          }
        }
        if (personalLogin || name !== selectedName() || entered !== password.value || session.current()?.id !== activeAtStart?.id) return;
      }
      if (!session.signIn(role, person, teacherWriting)) {
        showMessage("Allow this site to save your login and try again.", "请允许此网站保存登录状态，再试一次。");
        return;
      }
      password.value = "";
      const home = session.signInUrl();
      if (teacher) home.searchParams.set("entry", writingEntry);
      location.replace(session.destination(next, role) || home);
    } catch {
      showMessage("Open the website or local preview to sign in.", "请通过网站或本机预览地址登录。");
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("portal-sign-out").addEventListener("click", () => {
    const target = session.destination(next, requestedRole);
    session.signOut(target ? requestedRole : undefined, target);
  });
  async function openPersonalLogin() {
    const code = writingWorkspace?.takeLoginCode() ?? null;
    if (code === null) {
      render();
      return;
    }
    personalLogin?.abort();
    const opening = new AbortController();
    personalLogin = opening;
    workspace.hidden = true;
    header.hidden = true;
    account.hidden = true;
    login.hidden = false;
    submit.disabled = true;
    showMessage("Signing in with your personal link.", "正在登录 UNLOCK。");
    let failed;
    try {
      await writingWorkspace.signIn(code, opening.signal);
    } catch (error) {
      failed = error;
    }
    if (personalLogin !== opening) return;
    personalLogin = null;
    submit.disabled = false;
    render();
    if (failed) {
      const storageBlocked = failed.message === "session-storage-unavailable";
      const english = storageBlocked ? "Allow this browser to save the login in this tab and try again." :
        "Open the original personal sign-in link and try again.";
      const chinese = storageBlocked ? "请允许浏览器在此标签页保存登录状态后重试。" :
        "请重新打开收到的个人登录链接。";
      if (workspace.hidden) showMessage(english, chinese);
      else showWorkspaceNotice(english, chinese);
    }
  }

  session.watch(render);
  window.addEventListener("hashchange", openPersonalLogin);
  openPersonalLogin();
})();
