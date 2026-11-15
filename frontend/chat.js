/* Field Shift – "Talk to Ammi Salah": an on-phone assistant.
   It (1) explains how to use the app, (2) analyses the farmer's crop from THIS farm's data (the same NASA
   numbers and FSEngine simulation the game uses), and (3) answers agronomy questions only from a small,
   checked library of research papers (LIB below). Every answer lists its sources; nothing is generated
   from thin air, and when a question is outside the library Ammi Salah says so instead of guessing.
   Runs fully offline (no AI service, no key). */
(function () {
  "use strict";
  const A = window.FS_APP; if (!A) return;
  const S = () => A.S, esc = A.esc;
  const L = (ar, en) => (S().lang === "en" ? en : ar);
  const GM = () => window.FS_GAME || {};
  const E = () => window.FSEngine;

  // ---------------------------------------------------------------- verified library (each entry checked: authors, year, journal, DOI/URL)
  const LIB = {
    FAO56: { cite: "Allen, Pereira, Raes & Smith (1998). Crop evapotranspiration – Guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56, Rome.", url: "https://www.fao.org/4/x0490e/x0490e00.htm",
      used: ["ET0 (FAO-56 Penman–Monteith) computed from NASA POWER daily weather", "crop coefficients Kc by growth stage"] },
    FAO66: { cite: "Steduto, Hsiao, Fereres & Raes (2012). Crop yield response to water. FAO Irrigation and Drainage Paper 66, Rome. ISBN 978-92-5-107274-5.", url: "https://www.fao.org/4/i2800e/i2800e00.htm",
      used: ["yield response factor Ky: relative yield loss = Ky × relative ET deficit"] },
    PG99: { cite: "Porter & Gawith (1999). Temperatures and the growth and development of wheat: a review. European Journal of Agronomy 10(1): 23–36.", url: "https://doi.org/10.1016/S1161-0301(98)00047-1",
      used: ["hot day threshold Tmax > 31 °C around flowering"] },
    ASS15: { cite: "Asseng et al. (2015). Rising temperatures reduce global wheat production. Nature Climate Change 5: 143–147.", url: "https://doi.org/10.1038/nclimate2470",
      used: ["context: ~6% less global wheat per °C of further warming"] },
    SR06: { cite: "Saxton & Rawls (2006). Soil water characteristic estimates by texture and organic matter for hydrologic solutions. Soil Sci. Soc. Am. J. 70: 1569–1578.", url: "https://doi.org/10.2136/sssaj2005.0117",
      used: ["plant-available water of the top metre from sand, clay and organic matter"] },
    SG21: { cite: "Poggio et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL 7: 217–240.", url: "https://doi.org/10.5194/soil-7-217-2021",
      used: ["soil texture, organic carbon, pH and CEC at 250 m"] },
    ANG15: { cite: "Angus, Kirkegaard, Hunt, Ryan, Ohlander & Peoples (2015). Break crops and rotations for wheat. Crop & Pasture Science 66: 523–552.", url: "https://doi.org/10.1071/CP14252",
      used: ["rotation penalty for wheat after wheat; break-crop benefit"] },
    HER08: { cite: "Herridge, Peoples & Boddey (2008). Global inputs of biological nitrogen fixation in agricultural systems. Plant and Soil 311: 1–18.", url: "https://doi.org/10.1007/s11104-008-9668-3",
      used: ["legumes as the main nitrogen fixers in farming"] },
    JEN10: { cite: "Jensen, Peoples & Hauggaard-Nielsen (2010). Faba bean in cropping systems. Field Crops Research 115: 203–216.", url: "https://doi.org/10.1016/j.fcr.2009.10.008",
      used: ["faba bean N fixation and N benefit to the next crop"] },
    KN10: { cite: "Köpke & Nemecek (2010). Ecological services of faba bean. Field Crops Research 115: 217–233.", url: "https://doi.org/10.1016/j.fcr.2009.10.012",
      used: ["faba bean as a break crop in cereal rotations"] },
    ZO99: { cite: "Zhang & Oweis (1999). Water–yield relations and optimal irrigation scheduling of wheat in the Mediterranean region. Agricultural Water Management 38(3): 195–211.", url: "https://ideas.repec.org/a/eee/agiwat/v38y1999i3p195-211.html",
      used: ["wheat yield vs water use in northern Syria (ICARDA)"] },
    OH06: { cite: "Oweis & Hachum (2006). Water harvesting and supplemental irrigation for improved water productivity of dry farming systems in West Asia and North Africa. Agricultural Water Management 80: 57–73.", url: "https://doi.org/10.1016/j.agwat.2005.07.004",
      used: ["supplemental irrigation at critical stages"] },
    MH77: { cite: "Maas & Hoffman (1977). Crop salt tolerance – current assessment. J. Irrigation and Drainage Division (ASCE) 103(2): 115–134.", url: "https://doi.org/10.1061/JRCEA4.0001137",
      used: ["salinity threshold & slope: wheat 6.0 dS/m, barley 8.0, faba (broad) bean 1.6"] },
    SEN68: { cite: "Sen (1968). Estimates of the regression coefficient based on Kendall's tau. J. American Statistical Association 63: 1379–1389.", url: "https://doi.org/10.1080/01621459.1968.10480934",
      used: ["trend per decade (Theil–Sen) with a Kendall significance test"] },
    POWER: { cite: "NASA Langley Research Center, POWER Project (Prediction Of Worldwide Energy Resources), daily Agroclimatology data, API v2.", url: "https://power.larc.nasa.gov/docs/",
      used: ["daily rain, temperature, humidity, wind, solar radiation for the farm's ~50 km cell"] },
  };
  const srcHTML = (keys) => keys && keys.length ? `<details class="chsrc"><summary>📚 ${L("المصادر", "Sources")} (${keys.length})</summary><ol>${keys.map((k) => `<li>${esc(LIB[k].cite)} <a href="${LIB[k].url}" target="_blank" rel="noopener">${LIB[k].url.replace(/^https:\/\//, "").slice(0, 46)}</a></li>`).join("")}</ol></details>` : "";

  // ---------------------------------------------------------------- farm context (same numbers the game uses)
  function ctx() {
    let l = null; try { l = A.loc(); } catch (e) { }
    const s = S(), m = s.dataMeta || {};
    const src = m.mode === "wilaya" ? L(`بيانات ناسا لمقر ولاية ${m.wilayaAr || ""}`, `NASA data for the ${m.wilayaEn || ""} wilaya seat`)
      : m.source === "ERA5" ? L("بيانات ERA5 (ليست ناسا)", "ERA5 data (not NASA)") : m.mode === "live" ? L("بيانات ناسا لموقعك", "NASA data for your location")
      : m.mode === "fallback" ? L("بيانات نقطة أخرى", "data from another point") : L("بيانات تجريبية", "demo data");
    return { l, s, src, ready: !!(l && l.summary && s.locId) };
  }
  const sig = (t) => !!t && (t.significant != null ? t.significant : t.p < 0.05);
  const cname = (k) => (GM().cname ? GM().cname(k) : k);
  const pct = (v) => Math.round(v * 100) + "%";
  const CROPS = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch"];

  // ---------------------------------------------------------------- answers
  const ANS = {
    hello() { return { t: L(`أهلًا ${esc(S().name || "")}! أنا عمّي صالح. اسألني عن اللعبة، أو عن حالة محصولك، أو عن المطر والحرارة والتربة في أرضك. أجيبك من بيانات مزرعتك ومن أبحاث موثّقة فقط.`, `Hello ${esc(S().name || "")}! I'm Ammi Salah. Ask me about the game, your crop's status, or the rain, heat and soil on your land. I answer only from your farm's data and checked research papers.`), chips: ["analyse", "best", "help", "sources"] }; },
    help() {
      return { t: L(`هكذا تستعمل Field Shift:<br>1️⃣ اختر موقع أرضك (GPS، الخريطة أو الإحداثيات) فنجلب بيانات ناسا لها.<br>2️⃣ أجب عن أسئلة المزرعة (المساحة، التربة، الماء، المحاصيل السابقة).<br>3️⃣ في الصفحة الرئيسية ثلاثة أبواب: <b>تقرير ناسا</b> لأرضك، <b>خصائص المحاصيل</b>، و<b>اللعبة</b>.<br>4️⃣ في كل مستوى: المس العناصر المضيئة، اختر الأداة، واتّخذ القرار؛ زر <b>تلميح</b> يساعدك و<b>البيانات</b> تُظهر أرقام ناسا عند الحاجة.<br>5️⃣ في النهاية تحصل على تقرير مرونة مزرعتك.`,
        `How to use Field Shift:<br>1️⃣ Pick your land (GPS, map or coordinates); we fetch NASA data for it.<br>2️⃣ Answer the farm questions (area, soil, water, past crops).<br>3️⃣ The hub has three doors: your <b>NASA report</b>, <b>crop characteristics</b> and the <b>game</b>.<br>4️⃣ In each level: tap the glowing things, pick a tool, decide. <b>Hint</b> helps; <b>Data</b> shows the NASA numbers when you want them.<br>5️⃣ At the end you get your Farm Resilience Report.`), chips: ["analyse", "data", "levels"] };
    },
    levels() {
      return { t: L("المستويات تبدأ بالحصاد والتعرّف على مزرعتك، ثم اختيار المحاصيل، ثم تحديات المناخ: الجفاف، موجات الحر، الأمطار الغزيرة، توازن الماء والمغذيات، الملوحة، ومقامرة المناخ. كل مستوى يُفتح بعد الذي قبله، وكل قرار يُحسب على مواسم ناسا الحقيقية لأرضك.",
        "Levels start with harvesting and meeting your farm, then choosing crops, then climate challenges: drought, heatwave, heavy rain, the water–nutrient balance, salinity and the climate gamble. Each unlocks after the one before, and every decision is scored on your land's real NASA seasons."), chips: ["help", "analyse"] };
    },
    noFarm() { return { t: L("أحتاج موقع أرضك أولًا لأحلل محصولك. اختر موقعك من شاشة الموقع ثم اسألني من جديد.", "I need your land's location first to analyse your crop. Choose your location, then ask me again."), chips: ["help"] }; },

    analyse() {
      const c = ctx(); if (!c.ready || !GM().cropStats) return ANS.noFarm();
      const l = c.l, crop = GM().lastCrop ? GM().lastCrop() : "wheat", hist = (c.s.farm && c.s.farm.history) || [], prev = hist.find((x) => x && x !== "unknown") || "fallow";
      let st, su; try { su = GM().suitability ? GM().suitability(crop, prev) : null; st = su ? su.st : GM().cropStats(crop, prev); } catch (e) { return ANS.noFarm(); }
      const flags = (su && su.flags) || [], tr = l.trends || {}, lines = [], refs = ["POWER", "FAO56", "FAO66"];
      const lvl = su ? { ok: L("مناسب", "suitable"), adj: L("مناسب مع تعديلات", "suitable with adjustments"), high: L("مخاطرة عالية", "high risk"), na: L("غير كافٍ", "not enough info") }[su.level] : "";
      lines.push(L(`<b>${cname(crop)}</b> بعد ${prev === "fallow" ? "بور" : cname(prev)} على أرضك: ${lvl ? `<b>${lvl}</b>. ` : ""}المردود المتوقع ≈ <b>${pct(st.y)}</b> من الممكن في المتوسط، و<b>${pct(st.dry || 0)}</b> في أجفّ ثلاثة مواسم.`,
        `<b>${cname(crop)}</b> after ${prev === "fallow" ? "fallow" : cname(prev)} on your land: ${lvl ? `<b>${lvl}</b>. ` : ""}expected yield ≈ <b>${pct(st.y)}</b> of potential on average, and <b>${pct(st.dry || 0)}</b> in the three driest seasons.`));
      lines.push(L(`💧 الماء: متوسط ضغط الماء ${pct(1 - st.ws)} (نموذج الماء FAO-56 مع عامل Ky من FAO-66). مطر أكتوبر–ماي عندك ${l.summary.rain_mean} ملم.`, `💧 Water: average water stress ${pct(1 - st.ws)} (FAO-56 water balance with the FAO-66 Ky factor). Your Oct–May rain is ${l.summary.rain_mean} mm.`));
      if (st.heatRisk > 0) { refs.push("PG99"); lines.push(L(`🔥 الحرارة: في ${pct(st.heatRisk)} من المواسم تجاوزت الحرارة 31°م وقت الإزهار، وهي العتبة التي تضر الإخصاب في القمح (Porter & Gawith 1999).`, `🔥 Heat: in ${pct(st.heatRisk)} of seasons Tmax passed 31 °C at flowering, the threshold that harms pollination in wheat (Porter & Gawith 1999).`)); }
      if (flags.includes("rotation")) { refs.push("ANG15"); lines.push(L("🔁 الدورة: نفس العائلة بعد نفسها تخفّض المردود؛ القمح بعد محصول كسر (بقول، شوفان) يعطي أكثر (Angus وآخرون 2015).", "🔁 Rotation: the same family after itself lowers yield; wheat after a break crop (legume, oats) yields more (Angus et al. 2015).")); }
      if (flags.includes("salt")) { refs.push("MH77"); lines.push(L("🧂 الملوحة تحدّ هذا المحصول (نموذج عتبة–ميل لـ Maas & Hoffman 1977).", "🧂 Salinity limits this crop (Maas & Hoffman 1977 threshold–slope model).")); }
      if (flags.includes("broomrape")) lines.push(L("🌱 بقل بعد بقل: خطر الهالوك (Orobanche) يرتفع.", "🌱 Legume after legume: broomrape (Orobanche) risk goes up."));
      if (sig(tr.onset)) { refs.push("SEN68"); lines.push(L(`📅 مطر البذر يتأخر ${Math.round(tr.onset.per_decade)} يومًا كل عقد (اتجاه دال إحصائيًا).`, `📅 Sowing rain comes ${Math.round(tr.onset.per_decade)} days later per decade (statistically significant trend).`)); }
      // best alternatives on the same farm
      const rank = CROPS.map((k) => { try { return [k, GM().cropStats(k, crop).y]; } catch (e) { return [k, 0]; } }).sort((a, b) => b[1] - a[1]).slice(0, 3);
      lines.push(L(`✅ الأفضل بعد ${cname(crop)} على أرضك: ${rank.map(([k, y]) => `${cname(k)} (${pct(y)})`).join("، ")}.`, `✅ Best next after ${cname(crop)} on your land: ${rank.map(([k, y]) => `${cname(k)} (${pct(y)})`).join(", ")}.`));
      lines.push(`<span class="chnote">${L("المصدر:", "Source:")} ${c.src} · ${esc(l.period_label || (() => { const q = window.FS_DATA.seasons || []; return q.length ? q[0] + " – " + q[q.length - 1] : ""; })())}${L(" · محاكاة شهرية، ليست قياسًا لحقلك", " · monthly simulation, not a field measurement")}</span>`);
      return { t: lines.join("<br>"), refs, chips: ["symptoms", "water", "best"] };
    },

    best() {
      const c = ctx(); if (!c.ready || !GM().cropStats) return ANS.noFarm();
      const prev = GM().lastCrop ? GM().lastCrop() : "wheat";
      const rows = CROPS.map((k) => { try { const s = GM().cropStats(k, prev); return [k, s]; } catch (e) { return null; } }).filter(Boolean).sort((a, b) => b[1].y - a[1].y);
      return { t: L(`ترتيب المحاصيل بعد ${cname(prev)} على أرضك (متوسط المردود من الممكن / في الأجفّ):<br>`, `Crops after ${cname(prev)} on your land (average yield of potential / in dry years):<br>`)
        + rows.map(([k, s], i) => `${i + 1}. <b>${cname(k)}</b> ${pct(s.y)} / ${pct(s.dry || 0)}${s.heatRisk > 0.35 ? " 🔥" : ""}${s.rotPen < 1 ? " 🔁" : ""}`).join("<br>")
        + `<br><span class="chnote">🔥 ${L("حرارة عند الإزهار", "heat at flowering")} · 🔁 ${L("عقوبة الدورة", "rotation penalty")} · ${c.src}</span>`, refs: ["FAO56", "FAO66", "ANG15", "PG99"], chips: ["analyse", "rotation"] };
    },

    data() {
      const c = ctx(); if (!c.ready) return ANS.noFarm();
      const l = c.l, tr = l.trends || {}, d = (l.summary.driest || []).map((i) => (window.FS_DATA.seasons || [])[i]).filter(Boolean);
      const t = (k, unit, en, ar) => tr[k] ? L(`• ${ar}: ${tr[k].early} ← ${tr[k].late} ${unit} (${tr[k].per_decade > 0 ? "+" : ""}${tr[k].per_decade}/عقد، ${sig(tr[k]) ? "دال" : "غير دال؛ لا نسميه اتجاهًا"})`, `• ${en}: ${tr[k].early} → ${tr[k].late} ${unit} (${tr[k].per_decade > 0 ? "+" : ""}${tr[k].per_decade}/decade, ${sig(tr[k]) ? "significant" : "not significant, not a trend"})`) : "";
      return { t: L(`أرقام أرضك (${c.src}):<br>• مطر أكتوبر–ماي: ${l.summary.rain_mean} ملم في المتوسط${d.length ? `؛ أجفّ المواسم: ${d.join("، ")}` : ""}.<br>`, `Your land's numbers (${c.src}):<br>• Oct–May rain: ${l.summary.rain_mean} mm on average${d.length ? `; driest seasons: ${d.join(", ")}` : ""}.<br>`)
        + [t("rain", L("ملم", "mm"), "Oct–May rain", "مطر أكتوبر–ماي"), t("et0", L("ملم", "mm"), "Evaporation demand ET0", "الطلب على التبخر ET0"), t("onset", L("يوم", "days"), "Sowing-rain onset (days after 1 Sep)", "بداية مطر البذر (أيام بعد 1 سبتمبر)"), t("tmean", "°C", "Mean temperature", "متوسط الحرارة"), t("hot_flowering", L("يوم", "days"), "Hot days in Apr–May", "أيام حارة في أبريل–ماي")].filter(Boolean).join("<br>")
        + `<br><span class="chnote">${L("الاتجاه = ميل ثيل–سين مع اختبار كندال (p < 0.05).", "Trend = Theil–Sen slope with a Kendall test (p < 0.05).")}</span>`, refs: ["POWER", "FAO56", "SEN68"], chips: ["analyse", "heat", "sowing"] };
    },
    et0() { return { t: L("ET0 هو «عطش الجو»: كمية الماء التي يتبخرها عشب مرجعي مسقي جيدًا، نحسبها يوميًا بمعادلة بنمان–مونتيث من FAO-56 من حرارة ناسا ورطوبتها وريحها وإشعاعها. حاجة المحصول = Kc × ET0، وKc يتغير مع مرحلة النمو.", "ET0 is the air's thirst: the water a well-watered reference grass would evaporate. We compute it daily with the FAO-56 Penman–Monteith equation from NASA temperature, humidity, wind and sunshine. Crop need = Kc × ET0, and Kc changes with growth stage."), refs: ["FAO56", "POWER"], chips: ["water", "data"] }; },
    water() {
      const c = ctx(), rain = c.ready ? c.l.summary.rain_mean : null;
      return { t: L(`${rain ? `مطرك في الموسم ≈ ${rain} ملم. ` : ""}عندما يقل الماء المتاح عن حاجة المحصول (Kc × ET0) ينخفض المردود بنسبة Ky × نقص التبخر (FAO-66). في تجارب ICARDA بشمال سوريا زاد مردود القمح خطيًا مع الماء المستهلك فوق عتبة ~200 ملم (Zhang & Oweis 1999). الري التكميلي بكمية قليلة في المراحل الحرجة (قبل الإزهار وعنده) يرفع المردود ويثبّته (Oweis & Hachum 2006).`,
        `${rain ? `Your season rain ≈ ${rain} mm. ` : ""}When available water falls below the crop's need (Kc × ET0), yield drops by Ky × the ET deficit (FAO-66). In ICARDA trials in northern Syria, wheat yield rose linearly with water use above a ~200 mm threshold (Zhang & Oweis 1999). A little supplemental irrigation at the critical stages (just before and at flowering) raises and stabilises yield (Oweis & Hachum 2006).`), refs: ["FAO56", "FAO66", "ZO99", "OH06"], chips: ["analyse", "soil"] };
    },
    heat() {
      const c = ctx(), h = c.ready && c.l.trends && c.l.trends.hot_flowering;
      return { t: L(`فوق 31°م وقت الإزهار يقل نجاح التلقيح في القمح (Porter & Gawith 1999)، لذلك نعدّ الأيام الحارة في أبريل–ماي.${h ? ` عندك: ${h.early} ← ${h.late} يومًا (${sig(h) ? "اتجاه دال" : "غير دال"}).` : ""} عالميًا، يُقدَّر أن إنتاج القمح ينقص ~6% لكل درجة احترار إضافية (Asseng وآخرون 2015). الحلول: صنف أبكر، بذر أبكر عند وصول مطر البذر، أو محصول أقل حساسية كالشعير.`,
        `Above 31 °C at flowering, pollination success in wheat drops (Porter & Gawith 1999), so we count hot days in Apr–May.${h ? ` Yours: ${h.early} → ${h.late} days (${sig(h) ? "significant trend" : "not significant"}).` : ""} Globally, wheat production is estimated to fall ~6% per °C of further warming (Asseng et al. 2015). Options: an earlier variety, sowing as soon as the sowing rain arrives, or a less sensitive crop such as barley.`), refs: ["PG99", "ASS15", "POWER"], chips: ["analyse", "sowing"] };
    },
    soil() {
      const c = ctx(), so = c.ready && c.l.soil;
      return { t: L(`${so && so.texture ? `تربتك (SoilGrids): ${esc(so.texture)}، طين ${so.clay}% ورمل ${so.sand}%، ماء متاح للنبات في المتر الأول ≈ ${so.paw100} ملم. ` : ""}نحسب الماء المتاح من الرمل والطين والمادة العضوية بمعادلات Saxton & Rawls (2006)، وخرائط SoilGrids 2.0 بدقة 250 م تقديرية ويجب الحذر عند استعمالها لحقل واحد (Poggio وآخرون 2021). إن كنت تعرف تربتك فجوابك في الأسئلة يُستعمل بدلها.`,
        `${so && so.texture ? `Your soil (SoilGrids): ${esc(so.texture)}, ${so.clay}% clay, ${so.sand}% sand, plant-available water in the top metre ≈ ${so.paw100} mm. ` : ""}We compute available water from sand, clay and organic matter with the Saxton & Rawls (2006) equations. SoilGrids 2.0 maps (250 m) are estimates and need care for a single field (Poggio et al. 2021); if you know your soil, your own answer is used instead.`), refs: ["SR06", "SG21"], chips: ["water", "analyse"] };
    },
    rotation() {
      return { t: L("القمح بعد محصول «كسر» يعطي أكثر من القمح بعد القمح: في أكثر من 900 مقارنة كانت الزيادة من ~0.5 طن/هكتار بعد الشوفان إلى ~1.2 طن/هكتار بعد البقول، وتضعف في القمح الثاني وتكاد تختفي في الثالث (Angus وآخرون 2015). البقول تثبّت آزوت الهواء (Herridge وآخرون 2008)، والفول من أعلاها اعتمادًا على التثبيت ويوفّر سمادًا للمحصول التالي (Jensen وآخرون 2010) ويعمل محصولَ كسر في دورات الحبوب (Köpke & Nemecek 2010).",
        "Wheat after a break crop yields more than wheat after wheat: across >900 comparisons the gain ranged from ~0.5 t/ha after oats to ~1.2 t/ha after grain legumes, smaller for a second wheat and negligible for a third (Angus et al. 2015). Legumes fix nitrogen from the air (Herridge et al. 2008); faba bean relies most on fixation and saves fertiliser for the next crop (Jensen et al. 2010) and works as a break crop in cereal rotations (Köpke & Nemecek 2010)."), refs: ["ANG15", "HER08", "JEN10", "KN10"], chips: ["best", "analyse"] };
    },
    salt() {
      return { t: L("في نموذج Maas & Hoffman (1977) لا ينقص المردود حتى عتبة ملوحة، ثم ينقص بميل ثابت لكل dS/m: الشعير يتحمل حتى ~8.0 dS/m، القمح ~6.0، والفول حساس (~1.6). لذلك في الأرض المالحة الشعير هو الخيار الأأمن.",
        "In the Maas & Hoffman (1977) model, yield holds up to a salinity threshold, then falls by a fixed slope per dS/m: barley tolerates ~8.0 dS/m, wheat ~6.0, while faba (broad) bean is sensitive (~1.6). On salty land barley is the safest choice."), refs: ["MH77"], chips: ["best", "symptoms"] };
    },
    sowing() {
      const c = ctx(), o = c.ready && c.l.trends && c.l.trends.onset;
      return { t: L(`«مطر البذر» عندنا = أول يوم بعد 1 سبتمبر يصل فيه مجموع 3 أيام إلى 20 ملم، محسوبًا من بيانات ناسا اليومية.${o ? ` عندك: من ${o.early} إلى ${o.late} يومًا بعد 1 سبتمبر (${o.per_decade > 0 ? "+" : ""}${o.per_decade} يوم/عقد، ${sig(o) ? "دال إحصائيًا" : "غير دال"}).` : ""} إذا تأخر البذر تقصر مدة النمو قبل حر الربيع، فتفيد الأصناف الأبكر.`,
        `Our "sowing rain" = the first day after 1 Sep whose 3-day total reaches 20 mm, from NASA daily data.${o ? ` Yours: from ${o.early} to ${o.late} days after 1 Sep (${o.per_decade > 0 ? "+" : ""}${o.per_decade} days/decade, ${sig(o) ? "statistically significant" : "not significant"}).` : ""} Late sowing shortens the season before spring heat, so earlier varieties help.`), refs: ["POWER", "SEN68", "PG99"], chips: ["heat", "analyse"] };
    },
    frost() {
      const c = ctx(), f = c.ready && c.l.trends && c.l.trends.frost;
      return { t: L(`نعدّ يوم الصقيع عندما تنزل الحرارة الدنيا تحت 0°م (بيانات ناسا).${f ? ` عندك: ${f.early} ← ${f.late} يومًا في الموسم (${sig(f) ? "دال" : "غير دال"}).` : ""} الصقيع المتأخر وقت الإزهار أخطر من صقيع الشتاء.`, `A frost day is when the minimum temperature drops below 0 °C (NASA data).${f ? ` Yours: ${f.early} → ${f.late} days per season (${sig(f) ? "significant" : "not significant"}).` : ""} Late frost at flowering is more damaging than winter frost.`), refs: ["POWER", "SEN68"], chips: ["heat", "analyse"] };
    },
    symptoms() { return { t: L("ما الذي تراه في حقلك؟", "What do you see in your field?"), chips: ["s_yellow", "s_wilt", "s_crust", "s_gaps"] }; },
    s_yellow() { return { t: L("اصفرار الأوراق السفلية أولًا يدل غالبًا على نقص الآزوت، خاصة في القمح بعد القمح. محصول بقلي قبل القمح يزيد الآزوت المتاح (Herridge 2008؛ Jensen 2010). إن كان الاصفرار مع جفاف التربة فقد يكون ضغط ماء. هذا تشخيص تقريبي؛ تحليل التربة أو مرشد زراعي يؤكد.", "Yellowing that starts on the lower leaves usually points to nitrogen shortage, especially in wheat after wheat. A legume before wheat raises available nitrogen (Herridge 2008; Jensen 2010). If it comes with dry soil it may be water stress. This is a rough guide; a soil test or an extension agent confirms it."), refs: ["HER08", "JEN10", "ANG15"], chips: ["analyse", "rotation"] }; },
    s_wilt() { const c = ctx(); return { t: L(`الذبول في منتصف النهار مع تربة جافة = ضغط ماء: الحاجة (Kc × ET0) أكبر من الماء المتاح.${c.ready ? ` عند أرضك الماء المتاح ≈ ${c.l.soil && c.l.soil.paw100 || "؟"} ملم في المتر الأول.` : ""} ريّة تكميلية عند الإزهار هي الأنفع إن توفر الماء (Oweis & Hachum 2006).`, `Midday wilting with dry soil = water stress: demand (Kc × ET0) exceeds the water available.${c.ready ? ` Your soil holds ≈ ${c.l.soil && c.l.soil.paw100 || "?"} mm in the top metre.` : ""} One supplemental irrigation at flowering helps most if water is available (Oweis & Hachum 2006).`), refs: ["FAO56", "OH06", "SR06"], chips: ["water", "analyse"] }; },
    s_crust() { return { t: L("قشرة بيضاء على سطح التربة بعد الري غالبًا أملاح. قِس ملوحة التربة (EC): فوق ~6 dS/m يبدأ القمح بالنقص، والشعير يتحمل حتى ~8، والفول حساس جدًا (Maas & Hoffman 1977). الغسيل بماء عذب وتحسين الصرف يساعدان.", "A white crust on the soil after irrigation is usually salt. Measure soil salinity (EC): wheat starts losing yield above ~6 dS/m, barley tolerates ~8, faba bean is very sensitive (Maas & Hoffman 1977). Leaching with fresh water and better drainage help."), refs: ["MH77"], chips: ["salt", "best"] }; },
    s_gaps() { const c = ctx(), o = c.ready && c.l.trends && c.l.trends.onset; return { t: L(`فراغات وضعف إنبات غالبًا من البذر قبل وصول مطر كافٍ.${o ? ` عند أرضك يصل مطر البذر بعد ${o.late} يومًا من 1 سبتمبر في المتوسط الحديث.` : ""} انتظر ~20 ملم في 3 أيام قبل البذر.`, `Gaps and poor emergence usually come from sowing before enough rain.${o ? ` On your land the sowing rain now arrives ~${o.late} days after 1 Sep on average.` : ""} Wait for ~20 mm over 3 days before sowing.`), refs: ["POWER"], chips: ["sowing", "analyse"] }; },
    sources() { return { t: L("هذه المكتبة التي أجيب منها، كل مرجع فيها تحققنا من مؤلفيه ومجلته ورابطه:", "This is the library I answer from; each reference was checked (authors, journal, link):"), refs: Object.keys(LIB), open: true, chips: ["analyse", "help"] }; },
    unknown() { return { t: L("لا أملك جوابًا موثّقًا عن هذا في مكتبتي، ولا أريد أن أخمّن. أستطيع: شرح التطبيق، تحليل محصولك من بيانات أرضك، أو الحديث عن الماء والحرارة والتربة والدورة الزراعية والملوحة ومطر البذر.", "I don't have a checked answer to that in my library, and I won't guess. I can: explain the app, analyse your crop from your land's data, or talk about water, heat, soil, rotation, salinity and sowing rain."), chips: ["analyse", "help", "water", "sources"] }; },
  };
  const CHIP = () => ({ analyse: L("🌾 حلّل حالة محصولي", "🌾 Analyse my crop"), best: L("🏆 أي محصول أفضل لأرضي؟", "🏆 Best crop for my land?"), help: L("❓ كيف أستعمل التطبيق؟", "❓ How do I use the app?"), sources: L("📚 المصادر", "📚 Sources"),
    data: L("🛰️ أرقام أرضي", "🛰️ My land's numbers"), levels: L("🎮 المستويات", "🎮 The levels"), water: L("💧 الماء والري", "💧 Water & irrigation"), heat: L("🔥 الحرارة", "🔥 Heat"), soil: L("🟫 التربة", "🟫 Soil"), rotation: L("🔁 الدورة الزراعية", "🔁 Rotation"),
    salt: L("🧂 الملوحة", "🧂 Salinity"), sowing: L("📅 مطر البذر", "📅 Sowing rain"), symptoms: L("🔍 أعراض في حقلي", "🔍 Symptoms in my field"), s_yellow: L("اصفرار الأوراق", "Yellow leaves"), s_wilt: L("ذبول", "Wilting"), s_crust: L("قشرة بيضاء", "White crust"), s_gaps: L("إنبات ضعيف", "Poor emergence") });

  // ---------------------------------------------------------------- intent matching (Arabic + English keywords)
  const INTENTS = [
    ["sources", /source|paper|reference|research|study|مصدر|مصادر|مراجع|مرجع|بحث|أبحاث|دراس/i],
    ["s_yellow", /yellow|اصفر|صفراء/i], ["s_wilt", /wilt|ذبول|ذابل|يذبل/i], ["s_crust", /crust|white|قشرة|بيضاء|بياض/i], ["s_gaps", /emerg|gap|germinat|إنبات|انبات|فراغ/i],
    ["symptoms", /symptom|disease|sick|أعراض|مرض|مريض/i],
    ["analyse", /analy|status|health|my crop|my plant|how is|حلل|حلّل|تحليل|حالة|محصولي|نباتي|زرعي/i],
    ["best", /best|which crop|recommend|choose|suggest|plant what|أفضل|أي محصول|ماذا أزرع|انصح|اقترح|اختار/i],
    ["salt", /salt|salin|ec\b|ملوح|ملح|مالح/i], ["frost", /frost|cold|freez|صقيع|برد|جليد/i],
    ["sowing", /sow|onset|seed|plant(ing)? date|late rain|بذر|زرع|موعد|تأخر|مطر البذر/i],
    ["heat", /heat|hot|temperat|warm|حرار|حر\b|سخون|احترار/i],
    ["et0", /et0|eto|evapo|تبخر|نتح/i],
    ["rotation", /rotat|legume|nitrogen|break crop|after wheat|fertili|دورة|تناوب|بقول|بقولي|آزوت|ازوت|نيتروجين|سماد/i],
    ["soil", /soil|clay|sand|paw|تربة|طين|رمل/i],
    ["water", /water|irrig|drought|dry|rain|ماء|مياه|سقي|ري\b|جفاف|جاف|مطر/i],
    ["data", /nasa|data|number|report|trend|ناسا|بيانات|أرقام|تقرير|اتجاه/i],
    ["levels", /level|stage|mission|مستوى|مستويات|مرحلة/i],
    ["help", /how|use|play|start|button|what can|help|كيف|استعمل|أستعمل|ألعب|ابدأ|مساعدة|ساعد/i],
    ["hello", /^(hi|hello|salam|hey|السلام|سلام|مرحبا|أهلا|اهلا)/i],
  ];
  const intentOf = (q) => { for (const [k, re] of INTENTS) if (re.test(q)) return k; return "unknown"; };

  // ---------------------------------------------------------------- UI
  let LOG = [];
  function bubble(role, html, refs, open) {
    return `<div class="chmsg ${role}">${role === "bot" ? `<span class="chava">${A.salah(34)}</span>` : ""}<div class="chb">${html}${refs ? srcHTML(refs).replace("<details", open ? "<details open" : "<details") : ""}</div></div>`;
  }
  function chipsHTML(keys) { const C = CHIP(); return (keys || []).map((k) => `<button class="chchip" data-q="${k}">${C[k]}</button>`).join(""); }
  function render() {
    const box = document.getElementById("chLog"); if (!box) return;
    box.innerHTML = LOG.map((m) => bubble(m.role, m.html, m.refs, m.open)).join("");
    const last = LOG[LOG.length - 1]; document.getElementById("chChips").innerHTML = chipsHTML(last && last.chips);
    box.scrollTop = box.scrollHeight;
  }
  function answer(key) {
    const r = (ANS[key] || ANS.unknown)();
    LOG.push({ role: "bot", html: r.t, refs: r.refs, open: r.open, chips: r.chips });
  }
  function ask(text, key) {
    LOG.push({ role: "me", html: esc(text) });
    render();
    const box = document.getElementById("chLog"); box.insertAdjacentHTML("beforeend", `<div class="chmsg bot typing"><span class="chava">${A.salah(34)}</span><div class="chb"><i></i><i></i><i></i></div></div>`); box.scrollTop = box.scrollHeight;
    setTimeout(() => { answer(key || intentOf(text)); render(); try { window.FS_GAME && FS_GAME.snd && FS_GAME.snd("tap"); } catch (e) { } }, 550);
  }
  function open() {
    if (document.getElementById("chatOv")) return;
    if (!S().lang) S().lang = "ar";
    const ov = document.createElement("div"); ov.id = "chatOv"; ov.className = "chov";
    ov.setAttribute("dir", S().lang === "en" ? "ltr" : "rtl");
    ov.innerHTML = `<div class="chsheet" role="dialog" aria-label="${L("تحدث مع عمّي صالح", "Talk to Ammi Salah")}">
      <div class="chhead"><span class="chava big">${A.salah(46, "wave1")}</span><div style="flex:1"><b>${L("عمّي صالح", "Ammi Salah")}</b><small>${L("مساعدك الزراعي · يجيب من بيانات أرضك وأبحاث موثّقة", "Your farm helper · answers from your land's data and checked research")}</small></div><button class="chx" data-c="close" aria-label="${L("إغلاق", "Close")}">✕</button></div>
      <div class="chlog" id="chLog" aria-live="polite"></div>
      <div class="chchips" id="chChips"></div>
      <form class="chin" id="chForm" autocomplete="off"><input id="chText" placeholder="${L("اكتب سؤالك…", "Type your question…")}" maxlength="240"><button class="chsend" aria-label="${L("إرسال", "Send")}">➤</button></form></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-c=close]")) return close();
      const c = e.target.closest(".chchip"); if (c) ask(c.textContent, c.dataset.q);
    });
    document.getElementById("chForm").addEventListener("submit", (e) => { e.preventDefault(); const i = document.getElementById("chText"), q = i.value.trim(); if (!q) return; i.value = ""; ask(q); });
    if (!LOG.length) answer("hello");
    render();
    requestAnimationFrame(() => ov.classList.add("on"));
  }
  function close() { const ov = document.getElementById("chatOv"); if (!ov) return; ov.classList.remove("on"); setTimeout(() => ov.remove(), 250); }
  A.ACT.chatOpen = () => open();

  // Ammi Salah chat callable via A.ACT.chatOpen or FS_CHAT.open()
  try {
    const oldFab = document.getElementById("chFab");
    if (oldFab) oldFab.remove();
  } catch (e) {}

  window.FS_CHAT = { open, close, ask, intentOf, LIB, ANS };
})();
