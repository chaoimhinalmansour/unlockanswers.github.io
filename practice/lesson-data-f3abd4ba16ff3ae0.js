"use strict";
(function () {
  const routes = {"B02-LS-U01":"data/lesson-packs/B02-LS-U01-d408f3b766344e6e.json","B02-RW-U01":"data/lesson-packs/B02-RW-U01-97b67205d5711b10.json","B02-LS-U02":"data/lesson-packs/B02-LS-U02-097e5d6820abe0d4.json","B02-RW-U02":"data/lesson-packs/B02-RW-U02-feb0c82c31839b83.json","B02-LS-U03":"data/lesson-packs/B02-LS-U03-af0f98b9a6db0d4a.json","B02-RW-U03":"data/lesson-packs/B02-RW-U03-6016ca21754950f7.json","B02-LS-U04":"data/lesson-packs/B02-LS-U04-eb26aa3a03a216f7.json","B02-RW-U04":"data/lesson-packs/B02-RW-U04-28ad01af376b5e99.json","B02-LS-U05":"data/lesson-packs/B02-LS-U05-3c9a1474e8271a53.json","B02-RW-U05":"data/lesson-packs/B02-RW-U05-1a5c67d14c1a546f.json","B02-LS-U06":"data/lesson-packs/B02-LS-U06-94035d925e724b68.json","B02-RW-U06":"data/lesson-packs/B02-RW-U06-fce1fdd639032ea9.json","B02-LS-U07":"data/lesson-packs/B02-LS-U07-5866ed3b74acdbb9.json","B02-RW-U07":"data/lesson-packs/B02-RW-U07-261e5af3b6546855.json","B02-LS-U08":"data/lesson-packs/B02-LS-U08-65c58e2943ad107d.json","B02-RW-U08":"data/lesson-packs/B02-RW-U08-dad2ebdd6874b9e7.json","B03-LS-U01":"data/lesson-packs/B03-LS-U01-64f076d7444516cb.json","B03-RW-U01":"data/lesson-packs/B03-RW-U01-15245629a1ae8f8d.json","B03-LS-U02":"data/lesson-packs/B03-LS-U02-aa53ca34ad60bd65.json","B03-RW-U02":"data/lesson-packs/B03-RW-U02-dd081f26d89e5e7d.json","B03-LS-U03":"data/lesson-packs/B03-LS-U03-c80d5920e5d226e0.json","B03-RW-U03":"data/lesson-packs/B03-RW-U03-8888b12ed2f1a436.json","B03-LS-U04":"data/lesson-packs/B03-LS-U04-23c279e5a8acacda.json","B03-RW-U04":"data/lesson-packs/B03-RW-U04-3b4f1beca5791081.json","B03-LS-U05":"data/lesson-packs/B03-LS-U05-a4d6c186c35b6d5d.json","B03-RW-U05":"data/lesson-packs/B03-RW-U05-6d36fb720b8c03c6.json","B03-LS-U06":"data/lesson-packs/B03-LS-U06-ed7074ddae0663ff.json","B03-RW-U06":"data/lesson-packs/B03-RW-U06-9c2ebea26f6636c5.json","B03-LS-U07":"data/lesson-packs/B03-LS-U07-7566f09604606870.json","B03-RW-U07":"data/lesson-packs/B03-RW-U07-67b601204980c0be.json","B03-LS-U08":"data/lesson-packs/B03-LS-U08-2a99d26ecf1b181d.json","B03-RW-U08":"data/lesson-packs/B03-RW-U08-acfe3fef7795beb7.json"};
  const loaded = new Map();
  async function load(meta, code, signal) {
    if (!/^[LSRW]_H[123]$/.test(code)) return null;
    const track = /^[LS]/.test(code) ? "LS" : "RW";
    const id = "B" + String(meta.book).padStart(2, "0") + "-" + track + "-U" + String(meta.unit).padStart(2, "0");
    const cached = loaded.get(id);
    if (cached) return cached;
    if (!routes[id]) throw new Error("Classroom vocabulary unavailable for " + id);
    const response = await window.UnlockPracticeCatalog.readResource(routes[id], signal);
    const data = await response.json();
    if (data.id !== id || data.unit?.number !== meta.unit || !data.scope?.terms?.length || signal?.aborted) {
      throw new Error("Classroom vocabulary revision mismatch");
    }
    loaded.set(id, data);
    return data;
  }
  window.UnlockPracticeLessonData = { load };
})();
