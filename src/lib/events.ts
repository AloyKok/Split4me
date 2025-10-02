export type EventName =
  | "view_app"
  | "change_country"
  | "toggle_service_charge"
  | "change_tax"
  | "add_person"
  | "remove_person"
  | "assign_item"
  | "set_weights"
  | "choose_total_only"
  | "ocr_start"
  | "ocr_complete"
  | "copy_person"
  | "copy_all"
  | "export_pdf";

const logEvent = (name: EventName, payload?: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[event] ${name}`, payload);
  }
};

export const events = {
  emit: logEvent,
};
