"use client";

interface Props {
  accuracy: number;
  verifications: number;
}

export default function ReputationBar({ accuracy, verifications }: Props) {
  const color =
    accuracy >= 90 ? "bg-green-500" :
    accuracy >= 75 ? "bg-yellow-500" :
    "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Accuracy</span>
        <span className="font-bold text-white">{accuracy}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3">
        <div
          className={`${color} h-3 rounded-full transition-all duration-700`}
          style={{ width: `${accuracy}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{verifications.toLocaleString()} verifications</span>
        <span>{Math.round((accuracy / 100) * verifications).toLocaleString()} correct</span>
      </div>
    </div>
  );
}
