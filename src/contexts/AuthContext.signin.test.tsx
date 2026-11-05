import { act, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: { post: mocks.apiPost, get: vi.fn() },
  refreshAccessToken: vi.fn(),
}));

const tenantLogin = {
  status: "AUTHENTICATED",
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenType: "Bearer",
  expiresIn: 300,
  accessTokenExpiresAt: "2099-01-01T00:05:00.000Z",
  user: { id: "u1", email: "a@example.com", username: "a", fullName: "A" },
  organization: { id: "o1", code: "ORG", name: "Org" },
  organizations: [],
  permissions: [],
};

function OptOutProbe() {
  const auth = useAuth();
  return (
    <button
      onClick={() =>
        void auth.login({
          identifier: "a",
          password: "secret",
          rememberMe: false,
          supportsOrganizationSelection: false,
        })
      }
    >
      login
    </button>
  );
}

describe("AuthProvider sign-in options", () => {
  it("honours the picker opt-out and sends sign-in without a bearer token", async () => {
    mocks.apiPost.mockResolvedValue({ data: tenantLogin });

    render(
      <AuthProvider>
        <OptOutProbe />
      </AuthProvider>,
    );
    await act(async () => screen.getByText("login").click());

    expect(mocks.apiPost).toHaveBeenCalledWith(
      "/v1/auth/login",
      expect.objectContaining({ supportsOrganizationSelection: false }),
      { skipAuth: true },
    );
  });
});
