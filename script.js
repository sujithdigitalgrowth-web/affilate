let vendors = [];

const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const vendorGrid = document.getElementById("vendorGrid");
const resultsInfo = document.getElementById("resultsInfo");
const quickTags = document.getElementById("quickTags");
const template = document.getElementById("vendorCardTemplate");

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function compactText(value) {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureWebsiteUrl(value) {
  const website = compactText(value);
  if (!website) {
    return "";
  }

  return website.startsWith("http://") || website.startsWith("https://")
    ? website
    : `https://${website}`;
}

function normalizeVendor(rawVendor) {
  const services = asArray(rawVendor.services).map(compactText).filter(Boolean);
  const industries = asArray(rawVendor.industries).map(compactText).filter(Boolean);
  const models = asArray(rawVendor.models).map(compactText).filter(Boolean);
  const tags = asArray(rawVendor.tags).map(compactText).filter(Boolean);
  const contacts = asArray(rawVendor.contacts)
    .map((contact) => ({
      name: compactText(contact?.name),
      email: compactText(contact?.email)
    }))
    .filter((contact) => contact.name || contact.email);

  const description = compactText(rawVendor.description);
  const primaryEmail = compactText(rawVendor.primary_email);
  const websiteLabel = compactText(rawVendor.website);
  const strengthsSource = services.length
    ? services
    : tags.length
    ? tags
    : industries.length
    ? industries
    : models;

  const completenessSignals = [
    services.length,
    industries.length,
    models.length,
    tags.length,
    description,
    primaryEmail,
    websiteLabel,
    contacts.length
  ].filter(Boolean).length;

  return {
    id: rawVendor.sr_no || Math.random().toString(36).slice(2),
    name: compactText(rawVendor.company_name) || "Unknown Vendor",
    type: compactText(rawVendor.type) || "Unknown Type",
    description: description || "No public description available. Reach out for detailed capability mapping.",
    strengths: strengthsSource.slice(0, 5),
    categories: industries,
    models,
    tags,
    primaryEmail,
    websiteLabel,
    websiteUrl: ensureWebsiteUrl(websiteLabel),
    contacts,
    matchScore: Math.max(45, Math.round((completenessSignals / 8) * 100))
  };
}

function vendorMatches(vendor, query) {
  if (!query) {
    return true;
  }

  const contactTerms = vendor.contacts.flatMap((contact) => [contact.name, contact.email]);
  const haystack = [
    vendor.name,
    vendor.type,
    vendor.description,
    vendor.primaryEmail,
    vendor.websiteLabel,
    ...vendor.strengths,
    ...vendor.categories,
    ...vendor.models,
    ...vendor.tags,
    ...contactTerms
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function createChip(text) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = text;
  return chip;
}

function appendChipGroup(container, values, fallbackText) {
  const list = values.length ? values : [fallbackText];
  list.forEach((value) => {
    const chip = createChip(value);
    if (!values.length) {
      chip.classList.add("chip-muted");
    }
    container.appendChild(chip);
  });
}

function setContactLine(element, label, value, href) {
  element.innerHTML = "";

  const labelSpan = document.createElement("span");
  labelSpan.className = "contact-key";
  labelSpan.textContent = `${label}: `;
  element.appendChild(labelSpan);

  if (!value) {
    const fallback = document.createElement("span");
    fallback.className = "contact-empty";
    fallback.textContent = "Not listed";
    element.appendChild(fallback);
    return;
  }

  if (!href) {
    const text = document.createElement("span");
    text.textContent = value;
    element.appendChild(text);
    return;
  }

  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = value;
  element.appendChild(link);
}

function renderVendors(list, query) {
  vendorGrid.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>No vendors found.</strong><br />Try another category or service keyword.";
    vendorGrid.appendChild(empty);
    resultsInfo.textContent = `No results for \"${query}\"`;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((vendor) => {
    const card = template.content.firstElementChild.cloneNode(true);

    card.querySelector(".vendor-name").textContent = vendor.name;
    card.querySelector(".vendor-type").textContent = vendor.type;
    card.querySelector(".vendor-score").textContent = `${vendor.matchScore}% match`;
    card.querySelector(".vendor-blurb").textContent = vendor.description;

    const strengthsWrap = card.querySelector(".strengths");
    appendChipGroup(strengthsWrap, vendor.strengths, "Capabilities pending");

    const categoriesWrap = card.querySelector(".categories");
    appendChipGroup(categoriesWrap, vendor.categories.slice(0, 5), "Category data pending");

    const modelsWrap = card.querySelector(".models");
    appendChipGroup(modelsWrap, vendor.models.slice(0, 5), "Model data pending");

    const primaryContact = vendor.contacts[0] || { name: "", email: "" };
    const contactValue = vendor.primaryEmail
      ? primaryContact.name
        ? `${primaryContact.name} (${vendor.primaryEmail})`
        : vendor.primaryEmail
      : primaryContact.name
      ? primaryContact.email
        ? `${primaryContact.name} (${primaryContact.email})`
        : primaryContact.name
      : primaryContact.email;

    setContactLine(card.querySelector(".website"), "Website", vendor.websiteLabel, vendor.websiteUrl);
    setContactLine(card.querySelector(".contact"), "Contact", contactValue, "");

    fragment.appendChild(card);
  });

  vendorGrid.appendChild(fragment);
  resultsInfo.textContent = query
    ? `Showing ${list.length} vendor(s) for \"${query}\"`
    : `Showing all vendors (${list.length})`;
}

function applySearch(value) {
  const query = normalize(value);
  const filtered = vendors.filter((vendor) => vendorMatches(vendor, query));
  renderVendors(filtered, query);
}

async function loadVendors() {
  try {
    const response = await fetch("vendors_data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load vendor data: ${response.status}`);
    }

    const payload = await response.json();
    vendors = asArray(payload.vendors)
      .map(normalizeVendor)
      .sort((first, second) => second.matchScore - first.matchScore);

    renderVendors(vendors, "");
  } catch (error) {
    vendorGrid.innerHTML =
      '<div class="empty-state"><strong>Could not load vendor data.</strong><br />Please check vendors_data.json and reload.</div>';
    resultsInfo.textContent = "Vendor data unavailable";
  }
}

searchInput.addEventListener("input", (event) => {
  applySearch(event.target.value);
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  applySearch("");
  searchInput.focus();
});

quickTags.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tag]");
  if (!button) {
    return;
  }

  const tag = button.dataset.tag || "";
  searchInput.value = tag;
  applySearch(tag);
});

function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">✓</span>
    <span class="toast-message">${message}</span>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function initializeAddVendorModal() {
  const modal = document.getElementById("vendorModal");
  const addVendorBtn = document.getElementById("addVendorBtn");
  const closeModal = document.getElementById("closeModal");
  const cancelForm = document.getElementById("cancelForm");
  const addVendorForm = document.getElementById("addVendorForm");
  const modalOverlay = document.querySelector(".modal-overlay");

  function openModal() {
    modal.style.display = "flex";
  }

  function closeModalWindow() {
    modal.style.display = "none";
    addVendorForm.reset();
  }

  addVendorBtn.addEventListener("click", openModal);
  closeModal.addEventListener("click", closeModalWindow);
  cancelForm.addEventListener("click", closeModalWindow);
  modalOverlay.addEventListener("click", closeModalWindow);

  addVendorForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("vendorName").value.trim();
    const briefing = document.getElementById("vendorBriefing").value.trim();
    const goodAt = document.getElementById("vendorGoodAt").value.trim();
    const categories = document.getElementById("vendorCategories").value.trim();
    const models = document.getElementById("vendorModels").value.trim();
    const email = document.getElementById("vendorEmail").value.trim();
    const website = document.getElementById("vendorWebsite").value.trim();
    const contactName = document.getElementById("vendorContactName").value.trim();

    if (!name || !briefing || !categories || !email) {
      alert("Please fill in required fields: Vendor Name, Briefing, Categories, and Email");
      return;
    }

    const parseCommaSeparated = (value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const newVendor = {
      sr_no: vendors.length + 1,
      company_name: name,
      type: "Affiliate",
      primary_email: email,
      website: website || "",
      description: briefing,
      services: parseCommaSeparated(goodAt),
      industries: parseCommaSeparated(categories),
      models: parseCommaSeparated(models),
      tags: [],
      contacts: contactName ? [{ name: contactName, email: email }] : []
    };

    const normalizedVendor = normalizeVendor(newVendor);
    vendors.unshift(normalizedVendor);

    closeModalWindow();
    applySearch(searchInput.value);
    showToast(`✨ New vendor "${name}" added successfully!`);

    console.log("New vendor added:", normalizedVendor);
  });
}

initializeAddVendorModal();
loadVendors();
