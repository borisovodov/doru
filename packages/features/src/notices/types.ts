/** One entry in the third-party notices list. */
export interface ThirdPartyNotice {
  /** Project or product name. */
  name: string;
  /** Project homepage or repository; opened through the openExternal IPC (http/https only). */
  url?: string;
  /** License identifier as written by the project. */
  license: string;
  /** Full license text, reproduced verbatim; empty when the package ships none. */
  text: string;
}
