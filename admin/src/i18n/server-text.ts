import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { BackendError } from "@/lib/api";

export async function text(key: string, values?: Record<string, string | number>) {
  return (await getTranslations())(key, values);
}

const errorKeys: Record<string, string> = {
  RATE_LIMIT: "errors.tooManyRequestsTryAgainShortly",
  JOIN_REQUIRED: "feedback.joinRequired",
  INVALID_JOIN_CODE: "feedback.invalidJoin",
  SESSION_ENDED: "customer.thisDiningSessionHasEnded",
  CART_CHANGED: "feedback.cartChanged",
  EMPTY_ORDER: "feedback.emptyOrder",
  MENU_ITEM_UNAVAILABLE: "feedback.itemUnavailable",
  RESERVATION_ACCESS_REQUIRED: "feedback.verifyPhone",
  INVALID_SLOT: "feedback.invalidSlot",
  CANNOT_CANCEL: "feedback.cannotCancel",
  CANNOT_RESCHEDULE: "feedback.cannotReschedule",
  SAME_SLOT: "feedback.sameSlot",
  SLOT_UNAVAILABLE: "errors.thatTimeIsNoLongerAvailablePick",
  WRONG_PASSWORD: "feedback.wrongPassword",
  PASSWORD_UNCHANGED: "auth.chooseAPasswordDifferentFromTheTemporary",
  ACTIVE_TICKETS: "feedback.activeReset",
  IMAGE_TOO_LARGE: "menu.chooseAnImageNoLargerThan2",
  INVALID_IMAGE: "feedback.invalidImage",
  SESSION_CHANGED: "feedback.changed",
  STATUS_CHANGED: "feedback.changed",
  ORDER_CHANGED: "feedback.changed",
  RESERVATION_CHANGED: "feedback.changed",
  IMAGE_CONFLICT: "feedback.changed",
};

const actionableErrors: Record<string, string> = {
  INVALID_STATUS_TRANSITION: "feedback.invalidStatusTransition",
  LINE_LIMIT: "feedback.cartLineLimit",
  TOTAL_LIMIT: "feedback.cartTotalLimit",
};

export async function backendText(error: BackendError) {
  const actionableKey = actionableErrors[error.code];
  if (actionableKey) return text(actionableKey, error.code === "LINE_LIMIT" ? { limit: 50 } : undefined);
  if (await getLocale() === "en") return error.backendMessage;
  const t = await getTranslations();
  const key = errorKeys[error.code];
  if (key && t.has(key)) return t(key);
  if (error.status === 403) return t("errors.youDoNotHaveAccessToThis");
  if (error.status === 404) return t("feedback.notFound");
  if (error.status === 400 || error.status === 422) return t("errors.checkTheHighlightedFieldsAndTryAgain");
  return t("errors.theRequestFailedTryAgain");
}
