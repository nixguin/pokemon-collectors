export const RARITY_HIERARCHY = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  "Rare Holo": 4,
  "Ultra Rare": 5,
  "Secret Rare": 6,
  "Hyper Rare": 7,
  "Rainbow Rare": 8,
  "Gold Rare": 9,
  "Special Illustration Rare": 10,
  "Illustration Rare": 11,
  VMAX: 12,
  VSTAR: 13,
  "Amazing Rare": 14,
  Shining: 15,
  Crystal: 16,
  "Gold Star": 17,
  Prime: 18,
  Legend: 19,
  BREAK: 20,
  GX: 21,
  "TAG TEAM": 22,
  V: 23,
  Radiant: 24,
  "Classic Collection": 25,
};

export const getRarityValue = (rarity) => RARITY_HIERARCHY[rarity] || 0;

export const getAllRarities = () =>
  Object.keys(RARITY_HIERARCHY).sort(
    (a, b) => getRarityValue(a) - getRarityValue(b),
  );
