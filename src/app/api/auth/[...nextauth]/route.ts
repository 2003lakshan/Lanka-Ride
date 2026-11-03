import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const isProduction = process.env.NODE_ENV === "production";
const isHttps = process.env.NEXTAUTH_URL?.startsWith("https://") || false;
const useSecureCookies = isProduction && isHttps;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password");
        }

        const email = credentials.email.toLowerCase().trim();

        await dbConnect();
        const user = await User.findOne({ email });

        if (!user || !user.password) {
          throw new Error("No user found with this email");
        }

        const isPasswordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordMatch) {
          throw new Error("Invalid password");
        }

        const expectedRole = credentials.role;
        
        if (expectedRole) {
          if (expectedRole === "RIDER" && user.role === "DRIVER") {
            throw new Error("You are registered as a Driver. Please log in as a Driver.");
          }
          if (expectedRole === "DRIVER" && user.role === "TOURIST") {
            throw new Error("You are registered as a Rider. Please log in as a Rider.");
          }
        }

        return { 
          id: user._id.toString(), 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          phoneNumber: user.phoneNumber,
          isApproved: user.isApproved, 
          sessionVersion: user.sessionVersion || 0 
        };
      }
    })
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow relative callback URLs to stay on whatever host the user is currently on (LAN IP or localhost)
      if (url.startsWith("/")) return url;
      try {
        const parsedUrl = new URL(url);
        const allowedOrigins = [
          baseUrl,
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://192.168.8.100:3000"
        ];
        if (allowedOrigins.includes(parsedUrl.origin)) {
          return url;
        }
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phoneNumber = user.phoneNumber;
        token.isApproved = user.isApproved;
        token.sessionVersion = user.sessionVersion;
      } else if (token.id) {
        // Enforce server-side invalidation by verifying sessionVersion and refresh phone
        await dbConnect();
        const dbUser = await User.findById(token.id).select("sessionVersion phoneNumber").lean();
        const currentVersion = dbUser?.sessionVersion || 0;
        const tokenVersion = token.sessionVersion || 0;
        if (!dbUser || currentVersion !== tokenVersion) {
          throw new Error("Session revoked");
        }
        if (dbUser.phoneNumber !== undefined) {
          token.phoneNumber = dbUser.phoneNumber;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phoneNumber = token.phoneNumber;
        (session.user as any).isApproved = token.isApproved;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      }
    },
    callbackUrl: {
      name: useSecureCookies ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      }
    },
    csrfToken: {
      name: useSecureCookies ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
