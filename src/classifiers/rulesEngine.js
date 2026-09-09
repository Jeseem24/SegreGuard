/**
 * SegreGuard — CPCB Bio-Medical Waste Rules 2016 Rules Engine
 * Decouples visual perception (object detection) from legal statutory compliance.
 * Source: Ministry of Environment, Forest & Climate Change (MoEFCC), BMW Management Rules 2016, Schedule I.
 */

export const RULES_VERSION = 'BMW_RULES_2016_AMENDED_2019';

export const CPCB_SCHEDULE_I_RULES = {
  // YELLOW BIN: Incineration, plasma pyrolysis, or deep burial
  soiled_waste: {
    category: 'yellow',
    ruleCitation: 'Schedule I, Part-1, Item (b): Soiled Waste (cotton, dressings, soiled plaster casts, beddings contaminated with blood/body fluid)',
    disposalRoute: 'Incineration / Plasma Pyrolysis / Deep Burial',
    colorHex: '#F5C518',
    storageMaxHours: 48
  },
  anatomical_waste: {
    category: 'yellow',
    ruleCitation: 'Schedule I, Part-1, Item (a): Human Anatomical Waste (tissues, organs, body parts and fetus)',
    disposalRoute: 'Yellow Incinerator / Deep Burial',
    colorHex: '#F5C518',
    storageMaxHours: 48
  },
  ppe_soiled: {
    category: 'yellow',
    ruleCitation: 'Schedule I, Part-1, Item (b): Contaminated PPE (Masks, caps contaminated with blood/body fluids)',
    disposalRoute: 'Incineration / Autoclaving pre-treatment',
    colorHex: '#F5C518',
    storageMaxHours: 48
  },

  // RED BIN: Autoclaving/microwaving/hydroclaving followed by recycling
  contaminated_plastics: {
    category: 'red',
    ruleCitation: 'Schedule I, Part-1, Item (g): Contaminated Recyclable Waste (IV sets, bottles, tubing, catheters, urine bags, syringes without needles, gloves)',
    disposalRoute: 'Autoclaving / Microwaving → Shredding → Registered Plastic Recycler',
    colorHex: '#E53935',
    storageMaxHours: 48
  },

  // WHITE (TRANSLUCENT) CONTAINER: Puncture-proof, tamper-proof
  sharps_waste: {
    category: 'white',
    ruleCitation: 'Schedule I, Part-1, Item (e): Waste Sharps (Needles, syringes with fixed needles, scalpels, blades, contaminated needles)',
    disposalRoute: 'Autoclaving / Dry Heat Sterilization → Shredding/Mutilation → Recycling/Encapsulation',
    colorHex: '#ECEFF1',
    storageMaxHours: 48
  },

  // BLUE CONTAINER: Puncture-proof and leak-proof box
  glassware_implants: {
    category: 'blue',
    ruleCitation: 'Schedule I, Part-1, Item (h): Glassware & Metallic Implants (Medicine vials, ampoules, orthopedic implants)',
    disposalRoute: 'Disinfection (Sodium Hypochlorite soaking / Autoclaving) → Glass Recycling',
    colorHex: '#1E88E5',
    storageMaxHours: 48
  },

  // BLACK BIN: General Municipal Solid Waste (Non-Biomedical)
  general_municipal: {
    category: 'black',
    ruleCitation: 'Solid Waste Management Rules 2016: Non-contaminated general waste (paper, food wrappers, packaging)',
    disposalRoute: 'Municipal Composting / Sanitary Landfill',
    colorHex: '#212121',
    storageMaxHours: 72
  }
};

/**
 * Maps raw detected object classes to statutory CPCB Schedule I categories
 * @param {string} rawClass - Machine learning output label
 * @returns {Object} Deterministic regulatory decision
 */
export function evaluateLegalCategory(rawClass) {
  const normalized = (rawClass || '').toLowerCase().trim();

  if (normalized.includes('needle') || normalized.includes('scalpel') || normalized.includes('blade') || normalized.includes('fixed needle')) {
    return { ...CPCB_SCHEDULE_I_RULES.sharps_waste, categoryKey: 'white', label: 'White Container (Sharps)' };
  }
  if (normalized.includes('mask') || normalized.includes('cotton') || normalized.includes('bandage') || normalized.includes('anatomical')) {
    return { ...CPCB_SCHEDULE_I_RULES.soiled_waste, categoryKey: 'yellow', label: 'Yellow Bin' };
  }
  if (normalized.includes('syringe') || normalized.includes('glove') || normalized.includes('iv tube') || normalized.includes('catheter') || normalized.includes('plastic')) {
    return { ...CPCB_SCHEDULE_I_RULES.contaminated_plastics, categoryKey: 'red', label: 'Red Bin' };
  }
  if (normalized.includes('vial') || normalized.includes('ampoule') || normalized.includes('glass') || normalized.includes('implant')) {
    return { ...CPCB_SCHEDULE_I_RULES.glassware_implants, categoryKey: 'blue', label: 'Blue Bin' };
  }
  if (normalized.includes('wrapper') || normalized.includes('food') || normalized.includes('paper') || normalized.includes('box')) {
    return { ...CPCB_SCHEDULE_I_RULES.general_municipal, categoryKey: 'black', label: 'Black Bin (General Waste)' };
  }

  return {
    category: 'unknown',
    categoryKey: 'unknown',
    label: 'Unable to Certify',
    ruleCitation: 'CPCB Rule 8(2): Ambiguous bio-waste must be held for qualified manual inspection before binning',
    disposalRoute: 'Manual Clinical Verification Required',
    colorHex: '#FF8F00',
    storageMaxHours: 48
  };
}
