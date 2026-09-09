/* ── Classifier Interface ──
 * All UI code calls classify(), never a concrete implementation.
 * Grounded in India's Bio-Medical Waste Management Rules, 2016 (Schedule I).
 */

export { evaluateLegalCategory, CPCB_SCHEDULE_I_RULES, RULES_VERSION } from './rulesEngine.js';

// Confidence threshold — single source of truth (CPCB safety principle: fail-closed)
export const CONFIDENCE_THRESHOLD = 0.70;

// Category metadata for UI rendering
export const CATEGORY_INFO = {
  yellow: {
    label: 'Yellow Bin',
    badge: 'YELLOW',
    color: '#F5C518',
    bgColor: 'rgba(245, 197, 24, 0.12)',
    borderColor: '#F5C518',
    textColor: '#F5C518',
    disposalRoute: 'Incineration / Deep Burial',
    ruleCitation: 'CPCB 2016 Sched. I Part-1(b)',
    description: 'Soiled waste, cotton, contaminated PPE/masks, anatomical waste'
  },
  red: {
    label: 'Red Bin',
    badge: 'RED',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    textColor: '#EF4444',
    disposalRoute: 'Autoclaving → Shredding → Registered Recycler',
    ruleCitation: 'CPCB 2016 Sched. I Part-1(g)',
    description: 'Contaminated recyclables — gloves, IV tubes, catheters, syringes w/o needles'
  },
  white: {
    label: 'White Container (Sharps)',
    badge: 'WHITE (SHARPS)',
    color: '#F3F4F6',
    bgColor: 'rgba(243, 244, 246, 0.15)',
    borderColor: '#E5E7EB',
    textColor: '#F3F4F6',
    disposalRoute: 'Autoclaving → Dry Heat → Shredding / Encapsulation',
    ruleCitation: 'CPCB 2016 Sched. I Part-1(e)',
    description: 'Puncture-proof: Needles, scalpels, fixed-needle syringes, blades'
  },
  blue: {
    label: 'Blue Bin',
    badge: 'BLUE',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: '#3B82F6',
    textColor: '#60A5FA',
    disposalRoute: 'Sodium Hypochlorite Disinfection → Glass Recycling',
    ruleCitation: 'CPCB 2016 Sched. I Part-1(h)',
    description: 'Glassware, medicine ampoules, vials, orthopedic metal implants'
  },
  black: {
    label: 'Black Bin (General)',
    badge: 'BLACK (GENERAL)',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.12)',
    borderColor: '#4B5563',
    textColor: '#D1D5DB',
    disposalRoute: 'Municipal Composting / Sanitary Landfill',
    ruleCitation: 'Solid Waste Mgmt Rules 2016',
    description: 'Non-biomedical general waste — paper, food wrappers, packaging'
  },
  unknown: {
    label: 'Manual Verification Required',
    badge: 'AMBIGUOUS',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    textColor: '#FBBF24',
    disposalRoute: 'Hold for qualified medical staff verification',
    ruleCitation: 'CPCB Safety Fail-Closed Protocol',
    description: 'Confidence below 70% — human verification mandatory before disposal'
  }
};
