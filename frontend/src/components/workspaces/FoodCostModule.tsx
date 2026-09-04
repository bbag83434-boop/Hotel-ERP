'use client';

import React, { useState } from 'react';
import { FoodCostWorkspace } from '@/components/workspaces/FoodCostWorkspace';
import { FoodCostSettingsWorkspace } from '@/components/workspaces/FoodCostSettingsWorkspace';

/**
 * Food Cost module wrapper.
 *
 * PAGE 1: Food Cost (live calculator shown in the Admin Sidebar entry)
 * PAGE 2: Food Cost Settings — opened ONLY through the small ⚙ Settings icon on
 *         the main page (no separate sidebar/route entry).
 *
 * Both pages are admin-backed by the backend; this wrapper only manages which
 * of the two views is mounted.
 */
export const FoodCostModule: React.FC = () => {
  const [view, setView] = useState<'main' | 'settings'>('main');

  if (view === 'settings') {
    return <FoodCostSettingsWorkspace onBack={() => setView('main')} />;
  }
  return <FoodCostWorkspace onOpenSettings={() => setView('settings')} />;
};

export default FoodCostModule;