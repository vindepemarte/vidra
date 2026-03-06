"use client";

import { useState, useEffect } from "react";
import { Gift, Users, Trophy, Copy, Check, Share2 } from "lucide-react";

type ReferralStats = {
  referral_code: string | null;
  total_referrals: number;
  successful_referrals: number;
  credits_earned: number;
  referral_link: string;
};

type ReferralDisplayProps = {
  token: string | undefined;
};

export function ReferralDisplay({ token }: ReferralDisplayProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    const fetchStats = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrals/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch referral stats:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [token]);

  const copyToClipboard = async () => {
    if (!stats?.referral_link) return;
    
    try {
      await navigator.clipboard.writeText(stats.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const shareReferral = async () => {
    if (!stats?.referral_link) return;
    
    const shareData = {
      title: "Join Vidra - AI Influencer Platform",
      text: "Create your AI influencer with Vidra! Use my referral link to get bonus credits:",
      url: stats.referral_link,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        // User cancelled or error
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-6 border border-purple-500/20">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-purple-500/20 rounded w-1/2"></div>
            <div className="h-8 bg-purple-500/20 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-6 border border-purple-500/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Gift className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Referral Program</h3>
      </div>
      
      <p className="text-sm text-gray-300 mb-4">
        Share Vidra with friends! You both earn credits when they sign up.
      </p>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{stats.total_referrals}</div>
          <div className="text-xs text-gray-400">Referrals</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{stats.successful_referrals}</div>
          <div className="text-xs text-gray-400">Successful</div>
        </div>
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Gift className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{stats.credits_earned}</div>
          <div className="text-xs text-gray-400">Credits</div>
        </div>
      </div>
      
      {/* Referral Link */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Your Referral Link</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={stats.referral_link}
            readOnly
            className="flex-1 bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono truncate"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Copy</span>
              </>
            )}
          </button>
          <button
            onClick={shareReferral}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Rewards Info */}
      <div className="mt-4 pt-4 border-t border-purple-500/20">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">You earn:</span>
          <span className="text-green-400 font-semibold">100 credits per referral</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-400">They get:</span>
          <span className="text-purple-400 font-semibold">50 bonus credits</span>
        </div>
      </div>
    </div>
  );
}
