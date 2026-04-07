/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Index from "@/pages/Index";
import { Toaster } from "sonner";

export default function App() {
  return (
    <>
      <Index />
      <Toaster position="top-center" />
    </>
  );
}
