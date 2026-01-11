import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Copy,
  LogIn,
  Crown,
  Trophy,
  Medal,
  Award,
  Loader2,
  UserPlus,
  Trash2,
  Settings2,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shareStudyGroupInvite } from "@/utils/whatsappShare";

interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  email?: string;
  full_name?: string;
  total_badges: number;
  avg_score: number;
}

const StudyGroups = () => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get groups the user is a member of
      const { data: memberData } = await supabase
        .from("study_group_members")
        .select("group_id, role")
        .eq("user_id", user.id);

      const groupIds = memberData?.map(m => m.group_id) || [];
      
      if (groupIds.length === 0) {
        // Check if user created any groups
        const { data: createdGroups } = await supabase
          .from("study_groups")
          .select("*")
          .eq("created_by", user.id);

        if (createdGroups && createdGroups.length > 0) {
          // Auto-add creator as admin member
          for (const group of createdGroups) {
            await supabase.from("study_group_members").upsert({
              group_id: group.id,
              user_id: user.id,
              role: "admin",
            }, { onConflict: "group_id,user_id" });
          }
          setGroups(createdGroups.map(g => ({ ...g, is_admin: true })));
        } else {
          setGroups([]);
        }
        setLoading(false);
        return;
      }

      const { data: groupsData, error } = await supabase
        .from("study_groups")
        .select("*")
        .in("id", groupIds);

      if (error) throw error;

      // Add member count and admin status
      const enrichedGroups = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from("study_group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const memberInfo = memberData?.find(m => m.group_id === group.id);
          return {
            ...group,
            member_count: count || 0,
            is_admin: memberInfo?.role === "admin" || group.created_by === user.id,
          };
        })
      );

      setGroups(enrichedGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Failed to load study groups");
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newGroup, error: createError } = await supabase
        .from("study_groups")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add creator as admin member
      await supabase.from("study_group_members").insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: "admin",
      });

      setGroups((prev) => [...prev, { ...newGroup, member_count: 1, is_admin: true }]);
      setShowCreateDialog(false);
      setNewGroupName("");
      setNewGroupDescription("");
      toast.success("Study group created! Share the invite code with friends.");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const joinGroup = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find group by invite code
      const { data: group, error: findError } = await supabase
        .from("study_groups")
        .select("*")
        .eq("invite_code", inviteCode.trim().toLowerCase())
        .single();

      if (findError || !group) {
        toast.error("Invalid invite code. Please check and try again.");
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("study_group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        toast.info("You're already a member of this group!");
        setShowJoinDialog(false);
        setInviteCode("");
        return;
      }

      // Join the group
      const { error: joinError } = await supabase
        .from("study_group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "member",
        });

      if (joinError) throw joinError;

      setGroups((prev) => [...prev, { ...group, member_count: 1, is_admin: false }]);
      setShowJoinDialog(false);
      setInviteCode("");
      toast.success(`Joined "${group.name}" successfully!`);
      fetchGroups();
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Failed to join group");
    } finally {
      setJoining(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard!");
  };

  const viewGroupLeaderboard = async (group: StudyGroup) => {
    setSelectedGroup(group);
    setLoadingMembers(true);

    try {
      // Get group members
      const { data: members, error: membersError } = await supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", group.id);

      if (membersError) throw membersError;

      // Get user profiles and badges for each member
      const enrichedMembers = await Promise.all(
        (members || []).map(async (member) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("user_id", member.user_id)
            .single();

          const { data: badges } = await supabase
            .from("badges")
            .select("score")
            .eq("user_id", member.user_id);

          const totalBadges = badges?.length || 0;
          const avgScore = badges && badges.length > 0
            ? badges.reduce((acc, b) => acc + (b.score || 0), 0) / badges.length
            : 0;

          return {
            ...member,
            role: member.role as "admin" | "member",
            email: profile?.email,
            full_name: profile?.full_name,
            total_badges: totalBadges,
            avg_score: Math.round(avgScore),
          } as GroupMember;
        })
      );

      // Sort by badges then score
      enrichedMembers.sort((a: GroupMember, b: GroupMember) => {
        if (b.total_badges !== a.total_badges) return b.total_badges - a.total_badges;
        return b.avg_score - a.avg_score;
      });

      setGroupMembers(enrichedMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load group leaderboard");
    } finally {
      setLoadingMembers(false);
    }
  };

  const leaveGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSelectedGroup(null);
      toast.success("Left the group");
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave group");
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-medium w-5 text-center">{rank}</span>;
    }
  };

  const getDisplayName = (member: GroupMember) => {
    if (member.full_name) return member.full_name;
    if (member.email) {
      const [local] = member.email.split("@");
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return "Anonymous";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading study groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Study Groups
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Form study groups with friends and compete on group leaderboards together!
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
        <Button variant="outline" onClick={() => setShowJoinDialog(true)} className="gap-2">
          <LogIn className="h-4 w-4" />
          Join with Code
        </Button>
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-8 bg-secondary/30 rounded-xl">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">You're not in any study groups yet.</p>
          <p className="text-sm text-muted-foreground">Create one or join with an invite code!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:shadow-card transition-all"
              onClick={() => viewGroupLeaderboard(group)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {group.name}
                      {group.is_admin && (
                        <Badge variant="outline" className="text-xs">Admin</Badge>
                      )}
                    </CardTitle>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <UserPlus className="h-4 w-4" />
                    <span>{group.member_count || 1} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyInviteCode(group.invite_code);
                      }}
                      className="gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {group.invite_code}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        shareStudyGroupInvite(group.name, group.invite_code);
                      }}
                      title="Share on WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Study Group</DialogTitle>
            <DialogDescription>
              Create a group and invite your friends to compete together!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Biology Study Squad"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="What is this group about?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createGroup} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Study Group</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by your group admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Invite Code</label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g., abc12def"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button onClick={joinGroup} disabled={joining}>
              {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Join Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Leaderboard Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {selectedGroup?.name} Leaderboard
            </DialogTitle>
          </DialogHeader>

          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : groupMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No members yet</p>
          ) : (
            <div className="space-y-2">
              {groupMembers.map((member, index) => {
                const isCurrentUser = member.user_id === currentUserId;
                const rank = index + 1;

                return (
                  <div
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      isCurrentUser && "bg-primary/5 border border-primary/20",
                      rank <= 3 && "bg-secondary/50"
                    )}
                  >
                    <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {getDisplayName(member).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {getDisplayName(member)}
                        {isCurrentUser && <span className="text-primary ml-1">(You)</span>}
                        {member.role === "admin" && (
                          <Crown className="h-3 w-3 text-yellow-500 inline ml-1" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.total_badges} badges • Avg: {member.avg_score}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold text-foreground">{member.total_badges}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedGroup && !selectedGroup.is_admin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedGroup && leaveGroup(selectedGroup.id)}
              >
                Leave Group
              </Button>
            )}
            <Button variant="outline" onClick={() => selectedGroup && copyInviteCode(selectedGroup.invite_code)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
            <Button 
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => selectedGroup && shareStudyGroupInvite(selectedGroup.name, selectedGroup.invite_code)}
            >
              <MessageCircle className="h-4 w-4" />
              Share on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudyGroups;
