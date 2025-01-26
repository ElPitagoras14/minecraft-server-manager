import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import axios from "axios";
import { jwtDecode, JwtPayload } from "jwt-decode";

const API_URL = process.env.SERVER_API_URL;
const MAX_AGE = parseInt(process.env.AUTH_EXPIRE_MINUTES || "3600");

interface CustomJwtPayload extends JwtPayload {
  id: string;
  username: string;
  isAdmin: boolean;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
      token: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const loginOptions = {
          url: `${API_URL}/auth/login`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: credentials,
        };

        try {
          const response = await axios.request(loginOptions);
          const {
            data: {
              payload: { token },
            },
          } = response;

          if (!token) {
            return null;
          }

          const decodedToken = jwtDecode<CustomJwtPayload>(token);

          const { id, username, isAdmin } = decodedToken;
          const user = { id, name: username, isAdmin, token };
          return user;
        } catch (error: unknown) {
          console.error("error", error);
          return null
        }
      },
    }),
  ],
  jwt: {
    maxAge: MAX_AGE,
  },
  callbacks: {
    jwt({ token, user, session }) {
      if (user) {
        token.user = user;
      }
      if (session) {
        token.user = session.user;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user = token.user as never;
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  debug: true,
});
