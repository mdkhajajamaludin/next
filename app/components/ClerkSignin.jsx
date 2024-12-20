import { SignIn } from "@clerk/nextjs";

export default function ClerkSignIn() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#FAF9F7]">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}

