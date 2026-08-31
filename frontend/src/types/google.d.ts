export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: any) => void;
            [key: string]: any;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options?: {
              theme?: string;
              size?: string;
              width?: string | number;
              [key: string]: any;
            }
          ) => void;
          prompt?: (momentListener?: (notification: any) => void) => void;
          [key: string]: any;
        };
        [key: string]: any;
      };
      [key: string]: any;
    };
  }
}
