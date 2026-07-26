import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import {
  shouldRetryQuery,
  sourceRefetchInterval,
} from "./lib/sourcePolling";
import { ApiError } from "./api/client";

function renderApp(route = "/") {
  window.history.pushState({}, "", route);
  return render(<App />);
}

describe("App shell", () => {
  it("renders the landing page", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { name: /turn your sources/i })).toBeInTheDocument();
  });

  it("shows a styled not found route", () => {
    renderApp("/missing");
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it("keeps empty create notebook submissions disabled", async () => {
    window.fetch = () =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ success: true, data: [] }),
      });

    renderApp("/notebooks");
    const button = await screen.findByRole("button", { name: /create notebook/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/notebook title/i), {
      target: { value: "Physics" },
    });
    expect(button).toBeEnabled();
  });
});

describe("source polling", () => {
  it("stops retrying and polling on 400", () => {
    const error = new ApiError("A valid notebook id is required", {
      status: 400,
      data: {
        success: false,
        message: "A valid notebook id is required",
      },
    });

    expect(shouldRetryQuery(0, error)).toBe(false);
    expect(
      sourceRefetchInterval({
        state: {
          error,
          data: [{ status: "PROCESSING" }],
        },
      }),
    ).toBe(false);
  });

  it("stops polling when every source is terminal, including FAILED", () => {
    expect(
      sourceRefetchInterval({
        state: {
          error: null,
          data: [{ status: "READY" }, { status: "FAILED" }],
        },
      }),
    ).toBe(false);
  });

  it("continues polling while a source is pending or processing", () => {
    expect(
      sourceRefetchInterval({
        state: {
          error: null,
          data: [{ status: "READY" }, { status: "PENDING" }],
        },
      }),
    ).toBe(3000);
  });
});
