"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PlayCircle,
  GameController,
  CardsThree,
  GearSix,
  HouseSimple,
  SignOut,
  ChatCircle,
  CaretDown,
  List,
  Cube,
  Coin,
} from "@phosphor-icons/react";
import { useWords } from "../contexts/WordsContext";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { AVATAR_OPTIONS } from "../services/profileService";
import { AuthDialog } from "./AuthDialog";
import { SettingsModal } from "./SettingsModal";
import { FeedbackModal } from "./FeedbackModal";
import { useOfflineNavigation } from "../hooks/useOfflineNavigation";
import { useUserRoles } from "../hooks/useUserRoles";
import { useAIUsage } from "../hooks/useAIUsage";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NavLinkProps {
  active: boolean;
  badge?: number;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  tourId?: string;
}

function NavLink({  active, badge, icon: Icon, children, onClick, tourId }: NavLinkProps) {
  return (
    <button
      onClick={onClick}
      data-tour={tourId}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5",
        active
          ? "bg-gray-200 text-heading font-semibold"
          : "text-subtle hover:bg-gray-100 hover:text-heading"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center bg-emerald-500 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

interface MobileNavLinkProps {
  active: boolean;
  badge?: number;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
}

function MobileNavLink({  active, badge, icon: Icon, children, onClick }: MobileNavLinkProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 mx-2 text-left text-base font-medium transition-colors flex items-center gap-3 rounded-xl",
        active
          ? "bg-gray-100 text-heading"
          : "text-body hover:bg-gray-50"
      )}
      style={{ width: "calc(100% - 16px)" }}
    >
      <Icon className="h-5 w-5" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 ml-auto">
          {badge}
        </span>
      )}
    </button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { navigate } = useOfflineNavigation();
  const { reviewCount } = useWords();
  const { session, handleLogout } = useAuth();
  const { firstName: profileFirstName, avatar, isLoading: isProfileLoading } = useProfile();
  const { isAdmin, isReviewer } = useUserRoles();
  const { usage, isUnlimited } = useAIUsage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const displayName = profileFirstName || session?.user?.email?.split("@")[0] || "User";
  const avatarImage = AVATAR_OPTIONS.find(a => a.id === avatar)?.image || "/avatars/pomegranate.svg";

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <AuthDialog />

      <nav className="fixed top-0 pt-4 bg-white left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div
          className="bg-white border border-gray-200 shadow-sm px-2 pr-1 md:cursor-default cursor-pointer rounded-[24px]"
        >
          {/* Top bar row */}
          <div
            className="h-12 flex items-center gap-1 relative"
            onClick={() => {
              // Only toggle menu on mobile (md breakpoint is 768px)
              if (window.innerWidth < 768) {
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }
            }}
          >
            {/* Mobile: hamburger */}
            <div className="md:hidden rounded-full p-2">
              <List className="h-5 w-5" />
            </div>

            {/* Mobile: current page (absolutely centered) */}
            {!isMobileMenuOpen && (
              <div className="md:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm font-medium text-heading flex items-center gap-1.5">
                  {pathname === "/" && <><HouseSimple className="h-4 w-4" />Home</>}
                  {pathname === "/chat" && <><ChatCircle className="h-4 w-4" />Chat</>}
                  {pathname === "/my-words" && <><CardsThree className="h-4 w-4" />My words</>}
                  {pathname.startsWith("/play") && <><GameController className="h-4 w-4" />Play</>}
                  {pathname === "/review" && <><PlayCircle className="h-4 w-4" />Review</>}
                  {pathname.startsWith("/admin") && <><Cube className="h-4 w-4" />Admin</>}
                </span>
              </div>
            )}

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink
              active={pathname === "/"}
              icon={HouseSimple}
              onClick={() => handleNavigate("/")}
            >
              Home
            </NavLink>
            <NavLink
              active={pathname === "/chat"}
              icon={ChatCircle}
              onClick={() => handleNavigate("/chat")}
            >
              Chat
            </NavLink>
            <NavLink
              active={pathname === "/my-words"}
              icon={CardsThree}
              onClick={() => handleNavigate("/my-words")}
              tourId="my-words"
            >
              My words
            </NavLink>
            <NavLink
              active={pathname.startsWith("/play")}
              icon={GameController}
              onClick={() => handleNavigate("/play")}
              tourId="play"
            >
              Play
            </NavLink>
            <NavLink
              active={pathname === "/review"}
              icon={PlayCircle}
              badge={reviewCount}
              onClick={() => handleNavigate("/review")}
              tourId="review"
            >
              Review
            </NavLink>
            {(isAdmin || isReviewer) && (
              <>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <NavLink
                  active={pathname.startsWith("/admin")}
                  icon={Cube}
                  onClick={() => handleNavigate("/admin")}
                >
                  Admin
                </NavLink>
              </>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-2">
            {/* AI Usage chip */}
            {usage && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center rounded-full px-2 py-1.5 h-auto gap-1.5 text-sm font-medium bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 transition-colors cursor-pointer">
                    <Coin className="h-5 w-5 text-purple-500" weight="fill" />
                    <span>{isUnlimited ? "∞" : usage.limit - usage.count}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-72 p-0 overflow-hidden">
                  <div className="bg-purple-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                        <Coin className="h-5 w-5 text-purple-700" weight="fill" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-900">
                          {isUnlimited ? "∞" : usage.limit - usage.count}
                        </div>
                        <div className="text-xs text-purple-700">
                          {isUnlimited ? "unlimited credits" : `of ${usage.limit} credits left`}
                        </div>
                      </div>
                    </div>
                    {!isUnlimited && (
                      <div className="mt-3">
                        <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${((usage.limit - usage.count) / usage.limit) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-xs text-muted-foreground border-t">
                    {isUnlimited
                      ? "Admin accounts have unlimited AI credits."
                      : "Used for translations, sentences, and hints. Resets monthly."
                    }
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* User dropdown - only show when profile is loaded */}
            {!isProfileLoading && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-full p-1 h-auto gap-1.5 pr-3 shadow-sm text-sm font-medium animate-in fade-in duration-300"
                  >
                    <Image
                      src={avatarImage}
                      alt="Avatar"
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                    {displayName}
                    <CaretDown className="h-3 w-3 text-disabled" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-subtle">
                  {session?.user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  <GearSix className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsFeedbackOpen(true)}>
                  <ChatCircle className="w-4 h-4 mr-2" />
                  Send feedback
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <SignOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile avatar on right - only show when profile is loaded */}
          <div className="md:hidden flex items-center ml-auto mr-0.5" onClick={(e) => e.stopPropagation()}>
            {/* AI Usage chip */}
            {usage && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center rounded-full px-3 py-2 h-auto gap-2 text-sm font-medium bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 transition-colors cursor-pointer">
                    <Coin className="h-5 w-5 text-purple-500" weight="fill" />
                    <span>{isUnlimited ? "∞" : usage.limit - usage.count}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0 overflow-hidden">
                  <div className="bg-purple-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                        <Coin className="h-5 w-5 text-purple-700" weight="fill" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-900">
                          {isUnlimited ? "∞" : usage.limit - usage.count}
                        </div>
                        <div className="text-xs text-purple-700">
                          {isUnlimited ? "unlimited credits" : `of ${usage.limit} credits left`}
                        </div>
                      </div>
                    </div>
                    {!isUnlimited && (
                      <div className="mt-3">
                        <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all"
                            style={{ width: `${((usage.limit - usage.count) / usage.limit) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-xs text-muted-foreground border-t">
                    {isUnlimited
                      ? "Admin accounts have unlimited AI credits."
                      : "Used for translations, sentences, and hints. Resets monthly."
                    }
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          </div>

          {/* Mobile expanded menu */}
          <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className="border-t border-gray-200 py-2">
              <MobileNavLink
                active={pathname === "/"}
                icon={HouseSimple}
                onClick={() => handleNavigate("/")}
              >
                Home
              </MobileNavLink>
              <MobileNavLink
                active={pathname === "/my-words"}
                icon={CardsThree}
                onClick={() => handleNavigate("/my-words")}
              >
                My words
              </MobileNavLink>
              <MobileNavLink
                active={pathname.startsWith("/play")}
                icon={GameController}
                onClick={() => handleNavigate("/play")}
              >
                Play
              </MobileNavLink>
              <MobileNavLink
                active={pathname === "/review"}
                icon={PlayCircle}
                badge={reviewCount}
                onClick={() => handleNavigate("/review")}
              >
                Review
              </MobileNavLink>

              {/* Admin section */}
              {(isAdmin || isReviewer) && (
                <>
                  <div className="border-t my-2 mx-2" />
                  <MobileNavLink
                    active={pathname.startsWith("/admin")}
                    icon={Cube}
                    onClick={() => handleNavigate("/admin")}
                  >
                    Admin
                  </MobileNavLink>
                </>
              )}

              {/* Account section */}
              <div className="border-t my-2 mx-2" />
              <MobileNavLink
                active={false}
                icon={GearSix}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
              >
                Settings
              </MobileNavLink>
              <MobileNavLink
                active={false}
                icon={ChatCircle}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsFeedbackOpen(true);
                }}
              >
                Send feedback
              </MobileNavLink>
              <MobileNavLink
                active={false}
                icon={SignOut}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                Log out
              </MobileNavLink>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </nav>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  );
}
