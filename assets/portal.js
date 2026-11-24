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
  const shading = document.getElementById("portrait-shading");
  const shadeContext = shading.getContext("2d");
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

  // Trace each visible silhouette against the original 1536 by 1024 painting.
  const portraitOutlines = [
    // Portrait 1
    `M 0 774
     C 7 757 16 741 22 732 C 33 720 45 717 55 720
     C 67 719 78 717 88 714 C 98 711 104 705 107 696
     Q 101 698 102 688 Q 99 681 105 677
     C 93 675 88 670 85 661 C 76 651 81 636 88 631 L 96 626
     C 96 614 101 606 112 601 C 118 595 128 591 140 588
     C 149 580 161 579 175 587 Q 179 590 181 587
     C 196 584 206 598 209 615 Q 213 624 212 632
     C 222 638 226 648 224 658 C 226 670 219 681 210 686
     Q 205 692 211 698 Q 220 706 209 712 Q 199 720 205 731
     L 202 733 Q 196 721 204 712 Q 214 704 207 700 Q 201 693 205 685
     C 201 705 187 719 175 726 Q 183 730 195 732
     C 201 734 208 737 214 737 C 229 741 236 756 239 773
     C 243 790 244 805 242 817 C 244 830 236 839 244 852
     C 246 862 254 869 255 882 C 258 891 253 899 252 905
     Q 236 905 222 903 C 218 906 214 914 209 911
     Q 205 908 202 912 Q 198 914 195 910
     Q 192 914 185 911 L 182 909 Q 175 914 170 909
     Q 169 905 173 898 L 141 898
     C 142 905 142 914 137 917 Q 134 921 131 918
     Q 127 922 123 917 Q 119 919 115 915
     C 109 912 107 906 103 901 Q 97 892 94 888
     C 90 900 76 907 63 908 C 43 914 18 915 0 915 Z`,
    // Portrait 2
    `M 241 841
     C 243 815 246 782 252 755 C 256 735 267 719 283 711
     Q 287 708 281 708 Q 281 703 295 699
     C 302 696 310 694 317 693 Q 332 689 345 686
     Q 351 683 358 683 Q 361 675 370 674 L 370 670
     Q 362 667 363 660 Q 359 655 359 649
     C 354 648 352 640 354 635 Q 348 629 354 622
     C 348 616 356 606 360 603 Q 363 595 368 596
     Q 372 585 385 584 Q 392 577 399 580
     C 404 568 416 567 425 574 C 433 570 444 569 450 578
     Q 458 580 462 587 Q 469 588 469 600
     C 477 602 482 609 480 616 Q 483 620 479 629
     Q 487 638 482 648 Q 479 657 472 656 L 467 655
     C 462 669 460 682 451 693
     C 466 699 480 703 489 711 C 499 719 506 734 511 751
     C 517 769 521 790 522 808 Q 524 829 526 854
     Q 520 856 512 861 Q 504 866 492 882
     L 432 893 L 432 896 L 490 886 L 488 889
     Q 486 895 490 895 Q 495 893 499 884
     Q 496 891 501 892 Q 504 893 506 891
     Q 500 902 479 903 L 459 903
     L 430 901 L 423 898 Q 369 898 328 900
     Q 318 901 314 905 C 298 905 276 900 259 903 L 251 903
     Q 258 886 251 873 Q 247 866 244 852 Z`,
    // Portrait 3
    `M 526 854
     C 523 842 524 833 524 823 C 527 811 520 798 521 781
     C 520 761 527 744 540 734 Q 551 727 562 727
     Q 572 723 579 717 Q 570 711 568 701
     Q 566 689 568 678 Q 561 681 563 692 L 560 693
     Q 555 687 560 676 Q 550 670 560 656
     Q 555 647 566 639 Q 568 630 579 626
     C 590 609 607 601 625 600 C 643 599 658 608 668 619
     Q 680 627 680 635 Q 690 642 686 658
     Q 696 664 689 681 Q 685 692 678 698
     Q 679 707 674 715 C 688 714 700 716 708 718
     C 726 718 735 740 736 754 C 740 775 734 793 735 814
     C 735 835 731 851 733 867 Q 727 885 731 904
     Q 705 901 683 902 C 669 897 649 898 629 898
     Q 619 898 613 902 Q 600 897 588 899 Q 560 895 539 902
     Q 527 902 520 901 Q 524 895 522 889
     Q 516 895 512 894 Q 509 892 511 887
     Q 506 893 501 892 Q 496 891 499 884
     Q 495 893 490 895 Q 486 895 488 889
     L 490 886 L 432 896 L 432 893 L 492 882
     Q 504 866 512 861 Q 520 856 526 854 Z`,
    // Portrait 4
    `M 728 906
     C 728 883 731 862 737 842 C 742 817 747 783 757 757
     C 767 741 783 729 801 721 Q 813 711 827 707
     Q 838 700 842 693 C 831 694 821 687 818 680
     C 810 682 802 675 801 667 Q 790 661 793 654
     Q 785 646 796 640 Q 793 634 797 629
     Q 793 619 803 614 Q 799 605 808 597
     Q 812 587 823 586 Q 834 570 843 570
     C 848 560 862 564 870 570 Q 881 562 889 566
     C 896 566 901 573 899 577 Q 910 583 909 593
     Q 920 597 916 609 Q 922 616 914 622
     Q 916 632 909 635 L 910 640 Q 916 646 916 652
     Q 919 658 915 660 Q 921 673 914 684
     C 932 691 947 698 961 702 C 979 707 1000 714 1016 726
     C 1027 734 1031 752 1035 768 C 1039 789 1048 811 1053 829
     C 1058 845 1067 859 1068 872 Q 1074 888 1065 903
     Q 1059 914 1037 914 Q 1021 912 1011 913
     C 1005 920 1000 921 991 920 Q 982 920 980 915
     Q 972 915 972 909 Q 967 912 963 907
     Q 960 910 956 910 Q 951 908 954 901 Q 956 898 958 894
     Q 951 896 946 893 Q 939 891 944 885
     Q 923 885 897 885 Q 901 893 895 899
     Q 889 902 884 897 Q 885 904 880 907 Q 875 911 870 906
     Q 865 911 860 909 Q 856 910 851 907
     Q 844 913 838 910 Q 832 909 831 906
     Q 814 914 803 910 Q 787 913 768 912
     Q 739 917 728 906 Z`,
    // Portrait 5
    `M 1063 909
     Q 1061 903 1068 886 Q 1070 874 1064 857
     Q 1059 847 1054 830 C 1048 815 1046 798 1052 783
     C 1058 764 1068 740 1087 738 Q 1096 736 1104 731
     Q 1112 727 1123 726 Q 1126 718 1126 711 L 1126 696
     Q 1120 688 1117 690 Q 1113 695 1110 693
     Q 1111 690 1117 682 Q 1107 679 1104 673
     Q 1096 664 1099 657 Q 1093 650 1099 641
     Q 1098 635 1103 628 Q 1100 621 1109 616
     Q 1115 602 1131 601 Q 1135 594 1146 594
     Q 1154 586 1165 592 Q 1174 597 1182 596
     Q 1200 596 1202 608 Q 1206 614 1205 620
     Q 1216 626 1219 640 Q 1225 646 1222 658
     Q 1228 667 1218 674 Q 1220 681 1211 685
     Q 1204 694 1213 701 L 1210 704 Q 1201 699 1206 690
     Q 1196 709 1184 723 Q 1187 729 1201 732
     Q 1212 735 1225 742 C 1242 748 1250 767 1255 784
     Q 1258 794 1259 801 Q 1259 816 1260 827
     C 1258 840 1258 848 1259 859 Q 1257 877 1268 883
     Q 1274 893 1272 900 Q 1267 909 1260 907
     Q 1258 908 1254 905 Q 1250 911 1244 905
     Q 1238 908 1235 902 Q 1231 907 1228 902
     Q 1224 901 1226 896 L 1207 897
     Q 1208 904 1210 912 Q 1212 921 1208 923
     Q 1203 924 1199 919 Q 1196 923 1191 919
     Q 1187 920 1180 914 Q 1175 913 1171 906
     Q 1159 898 1149 895 Q 1135 892 1120 897
     Q 1117 900 1116 904 Q 1110 908 1103 906
     Q 1081 914 1063 909 Z`,
    // Portrait 6
    `M 1267 908
     Q 1272 902 1273 892 Q 1270 882 1264 877
     Q 1263 866 1257 859 Q 1257 845 1260 826
     Q 1259 814 1259 801 C 1256 774 1262 750 1276 732
     C 1288 716 1303 711 1320 706 Q 1337 700 1351 698
     Q 1362 695 1367 695 C 1371 684 1382 674 1380 668
     Q 1372 669 1374 661 Q 1369 659 1370 652
     Q 1360 650 1359 637 Q 1354 632 1359 625
     Q 1356 616 1364 610 Q 1361 605 1368 601
     C 1374 587 1385 582 1395 579 Q 1400 568 1411 570
     Q 1420 565 1429 565 Q 1448 561 1457 574
     C 1468 574 1475 584 1480 594 Q 1488 597 1488 610
     Q 1494 616 1489 623 Q 1498 629 1492 641
     Q 1496 650 1486 654 Q 1480 659 1471 658
     Q 1466 674 1457 687 Q 1452 697 1460 697
     C 1492 703 1518 713 1536 752 L 1536 899
     Q 1527 903 1520 902 Q 1511 901 1508 907
     Q 1501 916 1497 909 Q 1492 914 1488 908
     Q 1483 912 1479 904 Q 1472 908 1471 900
     Q 1466 895 1467 890 Q 1467 886 1471 882
     Q 1455 882 1429 883
     Q 1433 890 1432 900 Q 1434 908 1427 908
     C 1422 907 1422 899 1419 893 Q 1416 889 1415 886
     Q 1420 901 1415 903 Q 1408 906 1405 897
     Q 1401 903 1395 897 L 1390 892 Q 1384 897 1378 889
     Q 1371 883 1368 881 Q 1350 880 1337 893
     Q 1318 906 1297 903 Q 1283 908 1267 908 Z`,
  ].map(path => new Path2D(path));

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
    choice.type = "radio";
    choice.name = "student";
    choice.value = person.name;
    choice.setAttribute("aria-label", name);
    const target = document.createElement("label");
    target.className = "portrait-target";
    target.htmlFor = choice.id;
    const focus = document.createElement("span");
    focus.className = "portrait-focus";
    focus.setAttribute("aria-hidden", "true");
    const painting = document.createElement("span");
    painting.className = "portrait-painting";
    focus.append(painting);
    const pointer = document.createElement("span");
    pointer.className = "portrait-label";
    pointer.setAttribute("aria-hidden", "true");
    const caption = document.createElement("span");
    caption.className = "portrait-name";
    caption.lang = "en";
    caption.textContent = name;
    pointer.append(caption);
    option.append(choice, target, focus, pointer);
    return option;
  }

  portraits.replaceChildren(...roster.map(portraitOption));

  function selectedName() {
    return form.querySelector('input[name="student"]:checked')?.value;
  }

  function renderPortraitShading() {
    if (!shadeContext) return;
    const choice = portraits.querySelector(".portrait-hit:checked");
    const activeIndex = Number(choice?.parentElement.dataset.portraitSlot) - 1;
    const activeOutline = portraitOutlines[activeIndex];
    shadeContext.clearRect(0, 0, shading.width, shading.height);
    if (!activeOutline) return;

    shadeContext.save();
    shadeContext.translate(0, shading.height - 1024);
    const otherOutlines = new Path2D();
    // Rasterize all five outlines together to keep the tint even at shared edges.
    portraitOutlines.forEach((outline, index) => {
      if (index !== activeIndex) otherOutlines.addPath(outline);
    });
    shadeContext.fillStyle = "#6b6b6b";
    shadeContext.fill(otherOutlines);
    shadeContext.globalCompositeOperation = "destination-out";
    shadeContext.fill(activeOutline);
    shadeContext.restore();
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
      renderPortraitShading();
      if (renewingTeacher) {
        showMessage("Sign in again with the teacher password to open Writing Review.",
                    "请用教师密码重新登录一次，即可打开写作复盘。");
      } else showMessage("");
    }
  }

  form.addEventListener("change", event => {
    if (event.target.name === "student") {
      showMessage("");
      renderPortraitShading();
    }
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
