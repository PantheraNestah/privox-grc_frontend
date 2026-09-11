import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequirePlatformAuth } from "./RequirePlatformAuth";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: vi.fn(),
}));

const mockedUsePlatformAuth = vi.mocked(usePlatformAuth);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequirePlatformAuth />}>
          <Route path="/platform/dashboard" element={<div>Platform Dashboard</div>} />
        </Route>
        <Route path="/platform/login" element={<div>Platform Login</div>} />
      </Routes>
    </MemoryRouter>,
  );

const setAuth = (partial: { isAuthenticated: boolean; isLoading: boolean }) => {
  mockedUsePlatformAuth.mockReturnValue(partial as never);
};

describe("RequirePlatformAuth", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders nothing while the platform session is loading", () => {
    setAuth({ isAuthenticated: false, isLoading: true });
    const { container } = renderAt("/platform/dashboard");

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Platform Dashboard")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to the platform login", () => {
    setAuth({ isAuthenticated: false, isLoading: false });
    renderAt("/platform/dashboard");

    expect(screen.getByText("Platform Login")).toBeInTheDocument();
    expect(screen.queryByText("Platform Dashboard")).not.toBeInTheDocument();
  });

  it("renders the protected route for an authenticated platform admin", () => {
    setAuth({ isAuthenticated: true, isLoading: false });
    renderAt("/platform/dashboard");

    expect(screen.getByText("Platform Dashboard")).toBeInTheDocument();
  });
});
