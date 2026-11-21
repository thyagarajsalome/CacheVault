import React, { useState } from 'react';
import {
  HelpCircle,
  HardDrive,
  Sparkles,
  FolderInput,
  FolderSync,
  FolderPlus,
  Flame,
  Search,
  FolderArchive,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface GuideSection {
  id: string;
  tabKey: string;
  title: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  whyUseIt: string;
  steps: string[];
  proTip: string;
}

const GUIDES: GuideSection[] = [
  {
    id: 'drives',
    tabKey: 'drives',
    title: 'Drives Overview & Telemetry',
    tagline: 'Instant hardware health, capacity meters, and cluster slack inspection',
    badge: 'Hardware Telemetry',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: HardDrive,
    whyUseIt:
      'Provides sub-millisecond Windows kernel disk queries with capacity gauges, NTFS/exFAT file system diagnostics, and 1-click Explorer shortcuts.',
    steps: [
      'Click on any drive card to view total capacity, free space, and usage percentage.',
      'Check the Cluster Size indicator (4 KB is optimal; 1 MB exFAT on external drives will cause cluster slack waste).',
      'Use the quick action buttons to jump directly into C: Liberator or Smart Folder Mover.',
    ],
    proTip: 'If your C: drive exceeds 85% capacity, Windows performance slows down. Use C: Liberator to bring it below 80%.',
  },
  {
    id: 'liberator',
    tabKey: 'liberator',
    title: 'C: Drive Liberator',
    tagline: '1-click purge of temporary session caches, crash dumps, and dev package stores',
    badge: 'Space Reclaim',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: Sparkles,
    whyUseIt:
      'Windows and developer tools quietly accumulate tens of gigabytes in hidden directories like %LOCALAPPDATA%\\Temp, DirectX shader caches, npm cache, and pip cache.',
    steps: [
      'CacheVault automatically scans all clutter categories and displays exact file counts and sizes.',
      'Items labeled 100% SAFE (User Temp, Windows Temp, Crash Dumps, Shader Cache) can be deleted immediately with zero risk.',
      'Developer items (NPM package cache, Python pip cache, Gradle cache) can be selected to clear downloaded tarballs without affecting your active projects.',
      'Click "Liberate Selected Caches" to free up space instantly.',
    ],
    proTip: 'Running C: Liberator once every 2–4 weeks can recover 10 to 30 GB of SSD space.',
  },
  {
    id: 'redirector',
    tabKey: 'redirector',
    title: 'Windows Known Folder Redirector',
    tagline: 'Safely reroute Downloads, Documents, and Desktop to your 1 TB D: SSD',
    badge: 'Zero-Risk Rerouting',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    icon: FolderInput,
    whyUseIt:
      'Your C: drive is often a smaller, fast system SSD (e.g. 250 GB) while your D: drive is a massive 1 TB SSD. This feature prevents your C: drive from filling up by automatically sending future downloads and files to D:.',
    steps: [
      'Review the list of system folders (Downloads, Documents, Desktop, Pictures, Videos).',
      'Keep the toggle "Move existing files during redirection" switched ON so your existing files migrate seamlessly.',
      'Click "Redirect to D: Drive" next to the folder you wish to move.',
      'CacheVault transfers the data, establishes an invisible NTFS Junction link, and syncs Windows Explorer. All future downloads and browser saves will now land on D:!',
    ],
    proTip: 'Because CacheVault creates an NTFS Directory Junction, older legacy software looking for C:\\Users\\...\\Downloads will transparently read/write to D:\\Downloads without ever breaking.',
  },
  {
    id: 'junctions',
    tabKey: 'junctions',
    title: 'Smart Folder Junction Mover',
    tagline: 'Move any massive custom application or game folder to D: without breaking paths',
    badge: 'NTFS Portals',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    icon: FolderSync,
    whyUseIt:
      'Have heavy game folders, Android SDKs, Docker data, or AppData caches on C:? This moves the data to D: and leaves a symbolic junction so Windows thinks the folder never moved.',
    steps: [
      'Select a preset heavy folder (such as Android SDK or Gradle) or paste any custom folder path from C:.',
      'Specify the destination path on D:.',
      'Click "Migrate Folder & Create Junction". CacheVault copies byte-for-byte using multi-threaded Robocopy and establishes the junction.',
    ],
    proTip: 'You can test the junction by clicking "Open in Explorer" — you will see your files right where your applications expect them.',
  },
  {
    id: 'blueprints',
    tabKey: 'blueprints',
    title: 'Drive Blueprint Generator',
    tagline: '1-click professional folder architecture scaffolding for clean storage',
    badge: 'Organization',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: FolderPlus,
    whyUseIt:
      'Stop saving random folders everywhere. In 1 second, scaffold a clean, industry-standard folder hierarchy on your secondary drives.',
    steps: [
      'Choose a preset that matches your workflow: Full-Stack Developer, Creative Studio, Organized Storage, or Gaming.',
      'Select the target drive (e.g. D:\\ or E:\\).',
      'Optionally add or remove folders from the list.',
      'Click "Scaffold Workspace Blueprint Now" to create all folders cleanly, then click "Open Drive in Explorer" to begin using them.',
    ],
    proTip: 'Use the Full-Stack Developer preset to separate your active Projects from Sandboxes and Docker Data.',
  },
  {
    id: 'vacuum',
    tabKey: 'vacuum',
    title: 'Developer node_modules & .venv Vacuum',
    tagline: 'Hunt down abandoned build folders across projects and reclaim tens of gigabytes',
    badge: 'Developer Power Tool',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: Flame,
    whyUseIt:
      'Developers often have dozens of old projects with huge node_modules or .venv virtual environments (> 500 MB each) that haven’t been opened in 60+ days.',
    steps: [
      'Select your inactivity filter: "Older than 30 days" or "Dormant > 60 days".',
      'Click Scan. CacheVault searches your drives and lists dormant dependency folders with their last modified age and size.',
      'Check the boxes next to the abandoned projects you want to clean.',
      'Click "Vacuum Selected Dev Caches" to delete the expendable packages. Your actual source code and Git history remain 100% untouched!',
    ],
    proTip: 'If you ever need to work on the project again, simply run "npm install" or "pip install -r requirements.txt" to restore them.',
  },
  {
    id: 'giants',
    tabKey: 'giants',
    title: 'Giant File Hunter',
    tagline: 'Multi-threaded deep scan exposing massive ISOs, VM disks, and video files',
    badge: 'Disk Inspection',
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    icon: Search,
    whyUseIt:
      'Windows Explorer is notoriously bad at finding which single files are consuming your storage. Giant File Hunter locates files > 1 GB or > 2 GB in seconds.',
    steps: [
      'Select your minimum size filter (> 500 MB, > 1 GB, > 2 GB, or > 5 GB).',
      'Click "Scan Now".',
      'Review the top largest files on your machine with extension badges (ISO, VMDK, MP4, ZIP).',
      'Click the Folder icon to open its exact location in Explorer, or the Trash icon to delete it.',
    ],
    proTip: 'Look out for old Windows update backup files, downloaded Linux ISOs, or screen recordings that you no longer need.',
  },
  {
    id: 'organizer',
    tabKey: 'organizer',
    title: 'Smart Downloads Auto-Organizer',
    tagline: 'Automatically categorize messy incoming files into clean subfolders',
    badge: 'Smart Sorter',
    badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    icon: FolderArchive,
    whyUseIt:
      'Downloads folders quickly become chaotic junk drawers. This tool groups files into Installers, Archives, Documents, Media, Images, and Code.',
    steps: [
      'CacheVault automatically connects to your active Downloads folder and categorizes loose files.',
      'View the summary of files found under each category (e.g. 15 Installers, 8 Archives).',
      'Select which categories you want to organize.',
      'Click "Sort & Organize Downloads Now". Files are cleanly moved into designated subfolders without overwriting.',
    ],
    proTip: 'Your file names are protected: if a duplicate file name already exists in the destination, CacheVault appends a timestamp so nothing is ever overwritten.',
  },
  {
    id: 'health',
    tabKey: 'health',
    title: 'Health & S.M.A.R.T. Watchdog',
    tagline: 'Hardware error interpretation, uncorrectable sector warnings, and lifespan advice',
    badge: 'Drive Protection',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    icon: ShieldAlert,
    whyUseIt:
      'Decodes technical hardware registers (e.g. ID C6 Uncorrectable Sectors, Reallocated Sectors) into plain-English advice so you never lose precious data to hardware failures.',
    steps: [
      'Select any attached drive from the dropdown.',
      'Inspect the physical hardware status, bus type, and sector health assessment.',
      'Review the recommendations for backup schedules and file system resilience.',
    ],
    proTip: 'If any drive shows "Caution" or "Uncorrectable Sectors", back up your important files immediately and do not store single-copy data on it.',
  },
];

interface HelpGuideProps {
  onNavigateTab: (tabId: string) => void;
}

export const HelpGuide: React.FC<HelpGuideProps> = ({ onNavigateTab }) => {
  const [selectedSection, setSelectedSection] = useState<string>('redirector');

  const activeGuide = GUIDES.find((g) => g.id === selectedSection) || GUIDES[0];
  const Icon = activeGuide.icon;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-cyan-900/30 border border-blue-800/40 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              CacheVault Pro Knowledge Base & User Guide
            </h2>
            <p className="text-sm text-gray-400">
              Complete step-by-step documentation for every storage optimization feature. Select a feature below to learn how it works.
            </p>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Sidebar list + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation Menu */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Choose a Feature to Learn:
          </span>
          <div className="space-y-1.5">
            {GUIDES.map((guide) => {
              const GIcon = guide.icon;
              const isSelected = selectedSection === guide.id;
              return (
                <button
                  key={guide.id}
                  onClick={() => setSelectedSection(guide.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-cyan-500/60 shadow-md shadow-blue-500/10 text-white'
                      : 'bg-dark-800/40 border-gray-800/70 text-gray-300 hover:bg-dark-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <GIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold truncate">{guide.title}</span>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-gray-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-8 bg-dark-800/50 border border-gray-800 rounded-2xl p-6 space-y-6">
          {/* Header of Detail */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{activeGuide.title}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeGuide.badgeColor}`}>
                    {activeGuide.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{activeGuide.tagline}</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab(activeGuide.tabKey)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-cyan-600/20 transition-all self-start sm:self-auto"
            >
              <span>Open Feature Now</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Why Use It */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Why & When to Use It:
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed bg-dark-900/60 p-3.5 rounded-xl border border-gray-800/80">
              {activeGuide.whyUseIt}
            </p>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Step-by-Step How-To:
            </h4>
            <div className="space-y-2">
              {activeGuide.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-dark-900/40 border border-gray-800/70 p-3 rounded-xl text-xs text-gray-300"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold flex items-center justify-center text-[10px] border border-cyan-500/30">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip Box */}
          <div className="bg-emerald-900/15 border border-emerald-800/40 p-4 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-emerald-300">CacheVault Pro Tip:</div>
              <div className="text-xs text-gray-300 mt-0.5 leading-relaxed">{activeGuide.proTip}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
