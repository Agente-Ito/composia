"use client";

interface Props {
  accuracy: number;
  verifications: number;
  joinedAt: number;
}

interface Badge {
  label: string;
  description: string;
}

function getBadges(accuracy: number, verifications: number, joinedAt: number): Badge[] {
  const badges: Badge[] = [];
  const now = Date.now() / 1000;
  const monthsActive = Math.floor((now - joinedAt) / (30 * 24 * 3600));

  if (verifications >= 100)  badges.push({ label: "100 Verifications", description: "Completed 100+ verifications" });
  if (verifications >= 500)  badges.push({ label: "500 Verifications", description: "Completed 500+ verifications" });
  if (verifications >= 1000) badges.push({ label: "1000 Verifications", description: "Completed 1000+ verifications" });
  if (accuracy >= 90)        badges.push({ label: "Top Accuracy", description: "90%+ accuracy rate" });
  if (accuracy >= 95)        badges.push({ label: "Elite Accuracy", description: "95%+ accuracy rate — top 10%" });
  if (monthsActive >= 3)     badges.push({ label: "3 Month Veteran", description: "Active for 3+ months" });
  if (monthsActive >= 6)     badges.push({ label: "6 Month Diamond", description: "Consistent 6+ months" });

  return badges;
}

export default function BadgeList({ accuracy, verifications, joinedAt }: Props) {
  const badges = getBadges(accuracy, verifications, joinedAt);

  if (badges.length === 0) {
    return <p className="text-sm text-[#4A4E62]">No badges yet. Keep verifying!</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <div
          key={b.label}
          className="flex items-center bg-composia-void border border-composia-border rounded-full px-3 py-1 text-xs text-composia-text"
          title={b.description}
        >
          {b.label}
        </div>
      ))}
    </div>
  );
}
