const STORAGE_KEY = "healthylife-profile-v1";
const DEMO_PROFILE = Object.freeze({ heightCm: 168, currentWeightKg: 72, targetWeightKg: 66, targetDate: "", sex: null });
const SEX_VALUES = Object.freeze(["MALE", "FEMALE"]);
const BMI_GAUGE_MIN = 10;
const BMI_GAUGE_MAX = 40;
const BMI_CATEGORIES = Object.freeze({
  underweight: Object.freeze({ label: "Underweight", cssClass: "bmi-category--underweight", explanation: "Below the general adult healthy range." }),
  normal: Object.freeze({ label: "Normal range", cssClass: "bmi-category--normal", explanation: "Within the general adult BMI range of 18.5 to below 25." }),
  overweight: Object.freeze({ label: "Overweight", cssClass: "bmi-category--overweight", explanation: "Above the general adult BMI range; BMI alone cannot assess health." }),
  obesity: Object.freeze({ label: "Obesity range", cssClass: "bmi-category--obesity", explanation: "BMI is a screening measure and does not diagnose a health condition." })
});
const state = {
  profile: { ...DEMO_PROFILE }
};

const byId = (id) => document.getElementById(id);
const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = [...document.querySelectorAll(".page-section")];

function readProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEMO_PROFILE };
    const parsed = JSON.parse(saved);
    const profile = { ...DEMO_PROFILE, ...parsed };
    if (profile.sex === "male" || profile.sex === "female") {
      profile.sex = profile.sex.toUpperCase();
    }
    if (!isValidNumber(profile.heightCm, 50, 250)
        || !isValidNumber(profile.currentWeightKg, 20, 500)
        || !isValidNumber(profile.targetWeightKg, 20, 500)
        || ![null, ...SEX_VALUES].includes(profile.sex)
        || typeof profile.targetDate !== "string") {
      throw new Error("Saved profile values are invalid.");
    }
    return profile;
  } catch (error) {
    showStorageMessage("Saved settings could not be read. Reset demo data to start fresh.");
    console.error("Could not read the local HealthyLife profile.", error);
    return { ...DEMO_PROFILE };
  }
}

function saveProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
    byId("storageNotice").hidden = true;
    return true;
  } catch (error) {
    showStorageMessage("Your browser could not save these settings. They will be used until you close this page.");
    console.error("Could not save the local HealthyLife profile.", error);
    return false;
  }
}

function showStorageMessage(message) {
  const notice = byId("storageNotice");
  notice.textContent = message;
  notice.hidden = false;
}

function isValidNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function exactBmiFor(weight, height) {
  return Number(weight) / ((Number(height) / 100) ** 2);
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return BMI_CATEGORIES.underweight;
  if (bmi < 25) return BMI_CATEGORIES.normal;
  if (bmi < 30) return BMI_CATEGORIES.overweight;
  return BMI_CATEGORIES.obesity;
}

function setBmiCategoryClass(element, category) {
  Object.values(BMI_CATEGORIES).forEach(({ cssClass }) => element.classList.remove(cssClass));
  element.classList.add(category.cssClass);
}

function bmiGaugePosition(bmi) {
  const position = ((bmi - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)) * 100;
  return Math.max(0, Math.min(100, position));
}

function setSection(sectionId) {
  const current = sections.find((section) => section.id === sectionId) || sections[0];
  sections.forEach((section) => {
    const selected = section === current;
    section.hidden = !selected;
    section.classList.toggle("active", selected);
  });
  navLinks.forEach((link) => {
    const selected = link.dataset.section === current.id;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  byId("pageName").textContent = current.querySelector("h1").textContent.trim();
  if (current.id === "planner") drawPlannerChart(state.profile);
}

function formatKg(value) {
  return `${Number(value).toFixed(1)} kg`;
}

function updateDashboard(profile) {
  const exactBmi = exactBmiFor(profile.currentWeightKg, profile.heightCm);
  const bmi = Math.round((exactBmi + Number.EPSILON) * 10) / 10;
  const category = bmiCategory(exactBmi);
  const delta = Number(profile.targetWeightKg) - Number(profile.currentWeightKg);
  byId("dashboardBmi").textContent = bmi.toFixed(1);
  byId("dashboardWeight").textContent = Number(profile.currentWeightKg).toFixed(1);
  byId("dashboardTarget").textContent = Number(profile.targetWeightKg).toFixed(1);
  byId("dashboardDifference").textContent = Math.abs(delta).toFixed(1);
  byId("dashboardCategory").textContent = category.label;
  byId("bmiStatus").textContent = category.label.toUpperCase();
  setBmiCategoryClass(byId("bmiCard"), category);
  byId("bmiMeter").setAttribute("aria-label", `BMI ${bmi.toFixed(1)} is in the ${category.label} category.`);
  byId("differenceFootnote").textContent = delta === 0 ? "You’re at your selected goal" : delta < 0 ? "A gradual journey, at your pace" : "A personal planning goal";
  byId("bmiMarker").style.setProperty("--bmi-marker-position", `${bmiGaugePosition(exactBmi)}%`);
  drawPlannerChart(profile);
}

function getProfileFromPlanner() {
  const values = {
    heightCm: Number(byId("planHeight").value),
    currentWeightKg: Number(byId("currentWeight").value),
    targetWeightKg: Number(byId("targetWeight").value),
    targetDate: byId("targetDate").value,
    sex: state.profile.sex
  };
  if (!isValidNumber(values.heightCm, 50, 250)
      || !isValidNumber(values.currentWeightKg, 20, 500)
      || !isValidNumber(values.targetWeightKg, 20, 500)) return null;
  return values;
}

function syncProfileFromPlanner() {
  const profile = getProfileFromPlanner();
  if (!profile) return;
  state.profile = profile;
  updateDashboard(profile);
  saveProfile();
  updatePlanPreview(profile);
}

function updatePlanPreview(profile, result = null) {
  const exactCurrentBmi = exactBmiFor(profile.currentWeightKg, profile.heightCm);
  const exactTargetBmi = exactBmiFor(profile.targetWeightKg, profile.heightCm);
  const currentBmi = result?.currentBmi ?? Math.round((exactCurrentBmi + Number.EPSILON) * 10) / 10;
  const targetBmi = result?.targetBmi ?? Math.round((exactTargetBmi + Number.EPSILON) * 10) / 10;
  const change = result?.weightChangeKg ?? Number(profile.targetWeightKg) - Number(profile.currentWeightKg);
  const unsafeTarget = exactTargetBmi < 18.5;
  const unsafeLoss = exactCurrentBmi < 18.5 && change < 0;
  const unsafe = result ? !result.safeToPursue : unsafeTarget || unsafeLoss;
  byId("planCurrentBmi").textContent = currentBmi.toFixed(1);
  byId("planCurrentCategory").textContent = result?.currentCategory ?? bmiCategory(exactCurrentBmi).label;
  byId("planTargetBmi").textContent = targetBmi.toFixed(1);
  byId("planTargetCategory").textContent = result?.targetCategory ?? bmiCategory(exactTargetBmi).label;
  byId("planDifference").textContent = change === 0 ? "No change" : `${change < 0 ? "−" : "+"}${Math.abs(change).toFixed(1)} kg`;

  const range = Math.abs(change);
  const progress = change === 0 ? 100 : Math.min(100, Math.max(0, (range / Math.max(Number(profile.currentWeightKg), Number(profile.targetWeightKg))) * 100));
  byId("goalProgressBar").style.width = `${progress}%`;
  byId("goalProgressLabel").textContent = change === 0 ? "You’re at your selected goal" : "A guide to the distance between weights, not a measure of health";

  const safetyMessage = byId("safetyMessage");
  if (unsafe) {
    safetyMessage.hidden = false;
    safetyMessage.textContent = result?.safetyMessage || (unsafeTarget
      ? "This target is below the general adult BMI range. Consider discussing a suitable goal with a healthcare professional."
      : "Your current BMI is below the general adult range. This planner does not encourage further weight loss; consider speaking with a healthcare professional.");
  } else {
    safetyMessage.hidden = true;
    safetyMessage.textContent = "";
  }
  byId("planStatus").textContent = unsafe ? "REVIEW GOAL" : "READY";
  byId("planStatus").classList.toggle("warning", unsafe);

  const timelineTitle = byId("timelineTitle");
  const timelineText = byId("timelineText");
  if (unsafe) {
    timelineTitle.textContent = "Your wellbeing comes first";
    timelineText.textContent = "No weight-loss timeline is shown for a goal that falls below the general adult range.";
  } else if (change < 0 && result?.estimatedWeeksMin != null) {
    timelineTitle.textContent = "A flexible, illustrative pace";
    timelineText.textContent = `At a gradual 0.25–0.5 kg per week, this change could take about ${result.estimatedWeeksMin}–${result.estimatedWeeksMax} weeks. Actual progress varies; this is not medical advice or a deadline.`;
  } else if (change < 0) {
    const minimumWeeks = Math.ceil(range / 0.5);
    const maximumWeeks = Math.ceil(range / 0.25);
    timelineTitle.textContent = "A flexible, illustrative pace";
    timelineText.textContent = `At a gradual 0.25–0.5 kg per week, this change could take about ${minimumWeeks}–${maximumWeeks} weeks. Actual progress varies; this is not medical advice or a deadline.`;
  } else if (change > 0) {
    timelineTitle.textContent = "A flexible timeline";
    timelineText.textContent = "Weight-gain timelines vary. This planner does not estimate a rate; consider discussing a suitable approach with a healthcare professional.";
  } else {
    timelineTitle.textContent = "You’re at your selected goal";
    timelineText.textContent = "There’s no timeline estimate when your current and target weights are the same.";
  }
}

function populateInputs(profile) {
  byId("bmiHeight").value = profile.heightCm;
  byId("bmiWeight").value = profile.currentWeightKg;
  byId("planHeight").value = profile.heightCm;
  byId("currentWeight").value = profile.currentWeightKg;
  byId("targetWeight").value = profile.targetWeightKg;
  byId("targetDate").value = profile.targetDate || "";
  document.querySelectorAll('input[name="sex"]').forEach((input) => {
    input.checked = input.value === profile.sex;
  });
}

function drawPlannerChart(profile) {
  const canvas = byId("plannerChart");
  if (!canvas) return;
  const current = Number(profile.currentWeightKg);
  const target = Number(profile.targetWeightKg);
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  const width = bounds.width, height = bounds.height;
  const top = 15, bottom = 26, left = 31, right = 14;
  const plotHeight = height - top - bottom;
  const low = Math.floor(Math.min(current, target) - 3);
  const high = Math.ceil(Math.max(current, target) + 3);
  const yFor = (value) => top + plotHeight * (1 - (value - low) / (high - low));
  context.font = "9px 'DM Sans', sans-serif";
  context.textBaseline = "middle";
  for (let tick = 0; tick <= 2; tick += 1) {
    const y = top + (plotHeight * tick) / 2;
    const value = high - ((high - low) * tick) / 2;
    context.strokeStyle = "#edf1ef";
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.fillStyle = "#98a69f";
    context.textAlign = "right";
    context.fillText(value.toFixed(0), left - 7, y);
  }
  const positions = [left + (width - left - right) * 0.29, left + (width - left - right) * 0.72];
  const values = [current, target];
  const colors = ["#4aab82", "#e7b66b"];
  context.beginPath();
  context.moveTo(positions[0], yFor(current));
  context.lineTo(positions[1], yFor(target));
  context.strokeStyle = "#b5d7c5";
  context.setLineDash([4, 4]);
  context.stroke();
  context.setLineDash([]);
  values.forEach((value, index) => {
    context.beginPath();
    context.arc(positions[index], yFor(value), 5, 0, Math.PI * 2);
    context.fillStyle = colors[index];
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#fff";
    context.stroke();
    context.fillStyle = "#536b5e";
    context.textAlign = "center";
    context.font = "700 10px 'DM Sans', sans-serif";
    context.fillText(formatKg(value), positions[index], yFor(value) - 13);
    context.font = "9px 'DM Sans', sans-serif";
    context.fillStyle = "#899890";
    context.fillText(index === 0 ? "Current" : "Target", positions[index], height - 10);
  });
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function showBmiResult(bmi, categoryLabel, explanation, exactBmi = Number(bmi)) {
  const category = Object.values(BMI_CATEGORIES).find((candidate) => candidate.label === categoryLabel);
  if (!category) throw new Error("The BMI service returned an unknown category.");
  byId("bmiEmpty").hidden = true;
  byId("bmiResult").hidden = false;
  byId("resultBmi").textContent = Number(bmi).toFixed(1);
  byId("resultCategory").textContent = category.label;
  byId("resultExplanation").textContent = explanation || category.explanation;
  setBmiCategoryClass(byId("bmiResult"), category);
  byId("resultGauge").setAttribute("aria-label", `BMI ${Number(bmi).toFixed(1)} is in the ${category.label} category.`);
  byId("resultMarker").style.setProperty("--bmi-marker-position", `${bmiGaugePosition(exactBmi)}%`);
}

function validateFormNumber(input, min, max, label) {
  const value = input.value.trim() === "" ? NaN : Number(input.value);
  if (!Number.isFinite(value)) return `${label} is required and must be a number.`;
  if (value < min || value > max) return `${label} must be between ${min} and ${max}.`;
  return null;
}

async function postJson(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error("Could not connect to HealthyLife. Check that the app is running and try again.");
  }
  const body = await response.json();
  if (!response.ok) {
    const details = body.details ? Object.values(body.details).join(" ") : body.message;
    throw new Error(details || "The request could not be processed.");
  }
  return body;
}

async function calculateBmi(event) {
  event.preventDefault();
  const message = byId("bmiMessage");
  const heightError = validateFormNumber(byId("bmiHeight"), 50, 250, "Height");
  const weightError = validateFormNumber(byId("bmiWeight"), 20, 500, "Weight");
  if (heightError || weightError) {
    setMessage(message, heightError || weightError);
    return;
  }
  setMessage(message, "Calculating…", true);
  try {
    const heightCm = Number(byId("bmiHeight").value);
    const weightKg = Number(byId("bmiWeight").value);
    const result = await postJson("/api/bmi/calculate", { heightCm, weightKg });
    showBmiResult(result.bmi, result.category, result.explanation, exactBmiFor(weightKg, heightCm));
    state.profile.heightCm = heightCm;
    state.profile.currentWeightKg = weightKg;
    populateInputs(state.profile);
    saveProfile();
    updateDashboard(state.profile);
    syncProfileFromPlanner();
    setMessage(message, "Your BMI has been updated.", true);
  } catch (error) {
    setMessage(message, error.message);
  }
}

async function submitPlan(event) {
  event.preventDefault();
  const message = byId("plannerMessage");
  const validation = [
    validateFormNumber(byId("planHeight"), 50, 250, "Height"),
    validateFormNumber(byId("currentWeight"), 20, 500, "Current weight"),
    validateFormNumber(byId("targetWeight"), 20, 500, "Target weight")
  ].find(Boolean);
  if (validation) {
    setMessage(message, validation);
    return;
  }
  const profile = getProfileFromPlanner();
  const payload = {
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
    targetWeightKg: profile.targetWeightKg,
    ...(profile.targetDate ? { targetDate: profile.targetDate } : {})
  };
  setMessage(message, "Updating your plan…", true);
  try {
    const result = await postJson("/api/weight/plan", payload);
    state.profile = profile;
    saveProfile();
    updateDashboard(profile);
    updatePlanPreview(profile, result);
    setMessage(message, "Your plan has been updated.", true);
  } catch (error) {
    setMessage(message, error.message);
  }
}

function initialize() {
  state.profile = readProfile();
  populateInputs(state.profile);
  updateDashboard(state.profile);
  updatePlanPreview(state.profile);
  byId("bmiForm").addEventListener("submit", calculateBmi);
  document.querySelectorAll('input[name="sex"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.profile.sex = input.value;
      saveProfile();
    });
  });
  ["bmiHeight", "bmiWeight"].forEach((id) => {
    byId(id).addEventListener("input", () => {
      const heightCm = Number(byId("bmiHeight").value);
      const currentWeightKg = Number(byId("bmiWeight").value);
      if (!isValidNumber(heightCm, 50, 250) || !isValidNumber(currentWeightKg, 20, 500)) return;
      state.profile.heightCm = heightCm;
      state.profile.currentWeightKg = currentWeightKg;
      byId("planHeight").value = heightCm;
      byId("currentWeight").value = currentWeightKg;
      const bmi = exactBmiFor(currentWeightKg, heightCm);
      const category = bmiCategory(bmi);
      showBmiResult(Math.round((bmi + Number.EPSILON) * 10) / 10, category.label, category.explanation, bmi);
      saveProfile();
      updateDashboard(state.profile);
      updatePlanPreview(state.profile);
      setMessage(byId("bmiMessage"), "");
    });
  });
  byId("plannerForm").addEventListener("submit", submitPlan);
  ["planHeight", "currentWeight", "targetWeight", "targetDate"].forEach((id) => {
    byId(id).addEventListener("input", syncProfileFromPlanner);
    byId(id).addEventListener("change", syncProfileFromPlanner);
  });
  navLinks.forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    const section = link.dataset.section;
    history.replaceState(null, "", `#${section}`);
    setSection(section);
  }));
  document.querySelectorAll('a[href="#calculator"], a[href="#planner"], a[href="#dashboard"], a[href="#tips"]').forEach((link) => {
    if (link.classList.contains("nav-link")) return;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = link.getAttribute("href").slice(1);
      history.replaceState(null, "", `#${section}`);
      setSection(section);
    });
  });
  byId("resetDemo").addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Could not clear the local HealthyLife profile.", error);
      showStorageMessage("Your browser could not clear saved settings. You can clear this site’s storage in browser settings.");
      return;
    }
    state.profile = { ...DEMO_PROFILE };
    populateInputs(state.profile);
    updateDashboard(state.profile);
    updatePlanPreview(state.profile);
    setMessage(byId("plannerMessage"), "Demo data restored.", true);
    setSection("dashboard");
  });
  window.addEventListener("resize", () => {
    drawPlannerChart(state.profile);
  });
  const initialSection = window.location.hash.slice(1);
  setSection(sections.some((section) => section.id === initialSection) ? initialSection : "dashboard");
}

initialize();
