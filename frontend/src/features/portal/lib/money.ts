export const peso = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "Set at the counter";

  return amount === 0 ? "Free" : `₱${amount.toFixed(2)}`;
};
