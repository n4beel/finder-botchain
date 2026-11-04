// Specific error messages matching 57-finder.md specifications
export function formatFinderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("BadText")) {
    return "Name or description text is invalid (check length constraints).";
  }
  if (msg.includes("BadParams")) {
    return "Offer parameters out of range (check price, commission 1-30%, stock, duration).";
  }
  if (msg.includes("OfferNotFound")) {
    return "Offer not found.";
  }
  if (msg.includes("Ended")) {
    return "This offer has ended.";
  }
  if (msg.includes("SoldOut")) {
    return "This offer is sold out.";
  }
  if (msg.includes("SellerCannotBuy")) {
    return "You are the seller of this offer and cannot purchase it.";
  }
  const paymentMatch = msg.match(/WrongPayment\((\d+)\)/);
  if (paymentMatch || msg.includes("WrongPayment")) {
    return "Payment amount does not match the offer price.";
  }
  if (msg.includes("BadFinder")) {
    return "The finder can't be you, the seller or this contract. Buy without a finder, or use another link.";
  }
  if (msg.includes("NothingToWithdraw")) {
    return "No pending earnings available to withdraw.";
  }
  if (msg.includes("TransferFailed")) {
    return "Transfer failed.";
  }
  if (msg.includes("User rejected") || msg.includes("User denied")) {
    return "Transaction was rejected in wallet.";
  }

  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
}
