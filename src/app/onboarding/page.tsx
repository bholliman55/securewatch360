"use client";

import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import styles from "./onboarding.module.css";

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = (tenantId: string) => {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    router.push(`/analyst${query}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>SecureWatch360</p>
        <h1 className={styles.pageTitle}>Welcome to SecureWatch360</h1>
        <p className={styles.pageSubtitle}>
          Let&apos;s get your security posture set up in 5 minutes.
        </p>
      </header>
      <OnboardingWizard onComplete={handleComplete} />
    </div>
  );
}
