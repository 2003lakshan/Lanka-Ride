import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions = {
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

        return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, isApproved: user.isApproved };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isApproved = user.isApproved;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).isApproved = token.isApproved;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as any,
  },
  secret: process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
