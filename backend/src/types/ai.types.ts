export type SPAFramework =
  | "react"
  | "vue"
  | "angular"
  | "svelte"
  | "next"
  | "nuxt"
  | "remix"
  | "solid"
  | "unknown";

export interface ElementInfo {
  tag: string;
  selector: string;
  text?: string;
  id?: string;
  className?: string;
  role?: string;
  visible: boolean;
  enabled?: boolean;
}

// -----------------------------
// Inputs
// -----------------------------
export interface InputInfo extends ElementInfo {
  type: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
}
// -----------------------------
// Buttons
// -----------------------------
export interface ButtonInfo extends ElementInfo {
  type?: string;
  ariaLabel?: string;
}
// -----------------------------
// Links
// -----------------------------
export interface LinkInfo extends ElementInfo {
  href: string;
  target?: string;
}
// -----------------------------
// Forms
// -----------------------------
export interface FormInfo {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  selector: string;

  inputs: InputInfo[];
  buttons: ButtonInfo[];
}
// -----------------------------
// Interactive Panel
// -----------------------------
export interface DiscoveredPanel {
  trigger: {
    selector: string;
    text: string;
    role: string;
  };

  triggerType: "tab" | "accordion";

  revealedElements: ElementInfo[];

  url: string;
}
// -----------------------------
// SPA Routes
// -----------------------------
export interface RouteInfo {
  url: string;
  path: string;
  title: string;

  routeType: "link" | "programmatic" | "hash";

  discoveredFrom?: string;

  elements?: {
    inputs: InputInfo[];
    buttons: ButtonInfo[];
    links: LinkInfo[];
    forms: FormInfo[];
  };
}
// -----------------------------
// Network Requests
// -----------------------------
export interface NetworkRequest {
  url: string;

  method: string;

  resourceType?:
    | "document"
    | "xhr"
    | "fetch"
    | "script"
    | "stylesheet"
    | "image"
    | "font"
    | "media"
    | "other";

  // status?: number;

  // responseTime?: number;

  // success: boolean;
}
