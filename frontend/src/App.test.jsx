import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

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
