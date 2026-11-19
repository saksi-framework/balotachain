import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// The full suite runs about 1.8 s per test under load; `findBy*` and
// `waitFor` wait 3 s, not the default 1 s, so a slow run is not a failure.
configure({ asyncUtilTimeout: 3000 });
