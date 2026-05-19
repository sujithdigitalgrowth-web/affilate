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

loadVendors();
