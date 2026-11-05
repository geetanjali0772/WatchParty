import React from 'react';
import { Crown, ShieldCheck, User } from 'lucide-react';

export const RoleBadge = ({ role, size = 'sm' }) => {
  if (role === 'Host') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 shadow-sm">
        <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span>Host</span>
      </span>
    );
  }

  if (role === 'Moderator') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm">
        <ShieldCheck className="w-3 h-3 text-emerald-600" />
        <span>Moderator</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      <User className="w-3 h-3 text-gray-500" />
      <span>Participant</span>
    </span>
  );
};

export default RoleBadge;
