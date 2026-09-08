const IMGBB_API_KEY = "0bf75dea880937d78cf5e554ed16a2e1";
let uploadedImageUrls = [];
let currentTab = "watch"; // Default mode

const imageInput = document.getElementById("imageInput");
const statusDiv = document.getElementById("status");
const previewContainer = document.getElementById("previewContainer");
const resultText = document.getElementById("resultText");
const watchIdInput = document.getElementById("watchId");

// REJIMLARNI ALMASHTIRISH
function switchTab(tab) {
  currentTab = tab;

  const tabs = {
    watch: document.getElementById("tabWatch"),
    used: document.getElementById("tabUsed"),
    auction: document.getElementById("tabAuction"),
    installment: document.getElementById("tabInstallment"),
  };

  const fields = {
    priceRow: document.getElementById("priceRow"),
    auction: document.getElementById("auctionFields"),
    installment: document.getElementById("installmentFields"),
  };

  Object.values(tabs).forEach((t) => t.classList.remove("active"));
  fields.priceRow.classList.add("hidden");
  fields.auction.classList.add("hidden");
  fields.installment.classList.add("hidden");

  tabs[tab].classList.add("active");

  if (tab === "watch" || tab === "used") {
    fields.priceRow.classList.remove("hidden");
  } else if (tab === "auction") {
    fields.auction.classList.remove("hidden");
  } else if (tab === "installment") {
    fields.priceRow.classList.remove("hidden");
    fields.installment.classList.remove("hidden");
  }

  updatePostText();
}

// ID GENERATOR
function generateNextId() {
  const STORAGE_KEY = "thewatchhub_last_id";
  let lastNumber = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  lastNumber += 1;
  localStorage.setItem(STORAGE_KEY, String(lastNumber));
  return "T-" + String(lastNumber).padStart(4, "0"); // T-0001
}

watchIdInput.value = generateNextId();
updatePostText();

// INPUTLAR O'ZGARISHINI KUZATISH
document.querySelectorAll("input, select, textarea").forEach((el) => {
  if (el.id === "resultText" || el.id === "imageInput") return;
  el.addEventListener("input", updatePostText);
  el.addEventListener("change", updatePostText);
});

// RASMLARNI YUKLASH
imageInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  let successCount = 0;
  let failCount = 0;
  const failedNames = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    statusDiv.innerText = `⏳ (${i + 1}/${files.length}) "${
      file.name
    }" processing...`;
    statusDiv.style.color = "#fbbf24";

    try {
      const preparedFile = await convertImage(file, i);
      const formData = new FormData();
      formData.append("image", preparedFile);

      const res = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data && data.success) {
        const url = data.data.url;
        uploadedImageUrls.push(url);
        addPreview(url, uploadedImageUrls.length);
        successCount++;
      } else {
        failCount++;
        failedNames.push(`${file.name}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      failCount++;
      failedNames.push(`${file.name}`);
    }
  }

  if (failCount === 0) {
    statusDiv.innerText = "✅ All photos uploaded successfully!";
    statusDiv.style.color = "#4ade80";
  } else {
    statusDiv.innerText = `⚠️ ${successCount} uploaded, ${failCount} failed.`;
    statusDiv.style.color = "#f87171";
  }
  updatePostText();
  imageInput.value = "";
});

function addPreview(url, index) {
  const wrap = document.createElement("div");
  wrap.className = "preview-item";
  const img = document.createElement("img");
  img.src = url;
  wrap.appendChild(img);
  previewContainer.appendChild(wrap);
}

// RASMNI QAYTA ISHLASH (WebP)
async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch (err) {}
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Load fail"));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function convertImage(file, index) {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const maxWidth = 1080;
  let scale = 1;
  if (img.width > maxWidth) {
    scale = maxWidth / img.width;
  }
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (typeof img.close === "function") {
    img.close();
  }
  let blob = await canvasToBlob(canvas, "image/webp", 0.82);
  if (blob && blob.type === "image/webp") {
    return new File([blob], `photo_${Date.now()}_${index}.webp`, {
      type: "image/webp",
    });
  }
  blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  return new File([blob], `photo_${Date.now()}_${index}.jpg`, {
    type: "image/jpeg",
  });
}

// INSTALLMENT CALCULATOR
function calculateInstallmentPreview() {
  const calcBox = document.getElementById("instCalcPreview");
  if (!calcBox) return;

  const price = Number(document.getElementById("watchPrice").value) || 0;
  const minDown = Number(document.getElementById("instMinDown").value) || 0;
  const annualRate =
    Number(document.getElementById("instAnnualRate").value) || 0;
  const minMonths = Number(document.getElementById("instMinMonths").value) || 0;
  const maxMonths = Number(document.getElementById("instMaxMonths").value) || 0;

  if (!price || !minMonths || !maxMonths) {
    calcBox.innerHTML = "Enter Price, Rate and Terms.";
    return;
  }

  const computeMonthly = (months) => {
    const remaining = Math.max(price - minDown, 0);
    const totalInterest = remaining * (annualRate / 100) * (months / 12);
    const totalPayable = remaining + totalInterest;
    return totalPayable / months;
  };

  const monthlyAtMin = computeMonthly(minMonths);
  const monthlyAtMax = computeMonthly(maxMonths);

  calcBox.innerHTML = `
    Down Payment: $${minDown.toLocaleString()}<br/>
    Balance: $${Math.max(price - minDown, 0).toLocaleString()}<br/><br/>
    <strong>${minMonths} months: $${monthlyAtMin.toFixed(2)}/mo</strong><br/>
    <strong>${maxMonths} months: $${monthlyAtMax.toFixed(2)}/mo</strong>
  `;
}

// POST MATNINI YANGILASH (English Labels)
function updatePostText() {
  const id = document.getElementById("watchId").value.trim();
  const status = document.getElementById("watchStatus").value;
  const brand = document.getElementById("watchBrand").value.trim();
  const cardTitle = document.getElementById("watchCardTitle").value.trim();
  const refCode = document.getElementById("watchRefCode").value.trim();

  // Tech Specs (now text inputs)
  const material = document.getElementById("watchMaterial").value.trim();
  const bracelet = document.getElementById("watchBracelet").value.trim();
  const gender = document.getElementById("watchGender").value.trim();
  const glass = document.getElementById("watchGlass").value.trim();
  const mechanism = document.getElementById("watchMechanism").value.trim();
  const size = document.getElementById("watchSize").value.trim();
  const waterRes = document.getElementById("watchWaterResistance").value.trim();

  const instagram = document.getElementById("watchInstagram").value.trim();
  const youtube = document.getElementById("watchYoutube").value.trim();
  const description = document.getElementById("watchDescription").value.trim();
  const date = new Date().toLocaleDateString("ru-RU");

  const lines = [];

  // Mode Specific
  if (currentTab === "watch" || currentTab === "used") {
    const price = document.getElementById("watchPrice").value.trim();
    lines.push(`Type: ${currentTab === "watch" ? "market" : "used"}`);
    if (currentTab === "used") lines.push(`🔄 USED WATCH POST 🔄`);
    if (id) lines.push(`ID: ${id}`);
    lines.push(`Status: ${status}`);
    if (brand) lines.push(`Brand: ${brand}`);
    if (cardTitle) lines.push(`Card Title: ${cardTitle}`);
    if (refCode) lines.push(`Ref. Code / Model: ${refCode}`);
    if (price) lines.push(`Price: $${price}`);
  } else if (currentTab === "auction") {
    const startPrice = document.getElementById("aucStartPrice").value.trim();
    const bidStep = document.getElementById("aucBidStep").value.trim();
    const endTime = document.getElementById("aucEndTime").value;

    lines.push(`Type: auction`);
    lines.push(`🔥 AUCTION POST 🔥`);
    if (id) lines.push(`ID: ${id}`);
    lines.push(`Status: ${status}`);
    if (brand) lines.push(`Brand: ${brand}`);
    if (cardTitle) lines.push(`Card Title: ${cardTitle}`);
    if (refCode) lines.push(`Ref. Code / Model: ${refCode}`);
    if (startPrice) lines.push(`Start Price: $${startPrice}`);
    if (bidStep) lines.push(`Bid Step: +$${bidStep}`);
    if (endTime) lines.push(`End Time: ${endTime.replace("T", " ")}`);
  } else if (currentTab === "installment") {
    const price = document.getElementById("watchPrice").value.trim();
    const minDown = document.getElementById("instMinDown").value.trim();
    const annualRate = document.getElementById("instAnnualRate").value.trim();
    const minMonths = document.getElementById("instMinMonths").value.trim();
    const maxMonths = document.getElementById("instMaxMonths").value.trim();

    lines.push(`Type: installment`);
    lines.push(`🏦 INSTALLMENT POST 🏦`);
    if (id) lines.push(`ID: ${id}`);
    lines.push(`Status: ${status}`);
    if (brand) lines.push(`Brand: ${brand}`);
    if (cardTitle) lines.push(`Card Title: ${cardTitle}`);
    if (refCode) lines.push(`Ref. Code / Model: ${refCode}`);
    if (price) lines.push(`Total Price: $${price}`);
    if (minDown) lines.push(`Min. Down Payment: $${minDown}`);
    if (annualRate) lines.push(`Annual Rate: ${annualRate}%`);
    if (minMonths) lines.push(`Min. Term: ${minMonths} months`);
    if (maxMonths) lines.push(`Max. Term: ${maxMonths} months`);
  }

  // Common Tech Specs
  lines.push(`--------------------`);
  if (material) lines.push(`Case Material: ${material}`);
  if (mechanism) lines.push(`Mechanism: ${mechanism}`);
  if (glass) lines.push(`Glass: ${glass}`);
  if (bracelet) lines.push(`Bracelet/Strap: ${bracelet}`);
  if (gender) lines.push(`Gender: ${gender}`);
  if (size) lines.push(`Case Size: ${size}`);
  if (waterRes) lines.push(`Water Resistance: ${waterRes}`);

  lines.push(`--------------------`);
  lines.push(`Date: ${date}`);
  if (instagram) lines.push(`Instagram: ${instagram}`);
  if (youtube) lines.push(`Youtube: ${youtube}`);
  if (description) lines.push(`Description: ${description}`);

  // Images
  uploadedImageUrls.forEach((url, i) => {
    lines.push(`Image${i + 1}: ${url}`);
  });

  resultText.value = lines.join("\n");

  if (currentTab === "installment") {
    calculateInstallmentPreview();
  }
}

// NUSXALASH VA TOZALASH
function copyPost() {
  resultText.select();
  document.execCommand("copy");
  const copyBtn = document.getElementById("copyBtn");
  copyBtn.innerText = "✅ Copied!";
  setTimeout(() => {
    copyBtn.innerText = "📋 Copy Post";
  }, 2000);
}

function resetForm() {
  document.querySelectorAll("input, textarea").forEach((el) => {
    if (el.id === "watchId") {
      el.value = generateNextId();
    } else if (el.id === "aucBidStep") {
      el.value = "50";
    } else if (el.id === "instAnnualRate") {
      el.value = "20";
    } else if (el.id === "instMinMonths") {
      el.value = "6";
    } else if (el.id === "instMaxMonths") {
      el.value = "36";
    } else if (el.id !== "resultText") {
      el.value = "";
    }
  });

  document.querySelectorAll("select").forEach((el) => {
    if (el.id === "watchStatus") {
      el.value = "active";
    } else {
      el.selectedIndex = 0;
    }
  });

  uploadedImageUrls = [];
  previewContainer.innerHTML = "";
  statusDiv.innerText = "";
  imageInput.value = "";
  updatePostText();
}
