import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, Clock, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

const NotificationSettings = () => {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe, scheduleStudyReminder } = usePushNotifications();
  const [reminderTime, setReminderTime] = useState<string>(
    localStorage.getItem("talkpdf-reminder-time") || "18:00"
  );
  const [reminderDays, setReminderDays] = useState<string[]>(
    JSON.parse(localStorage.getItem("talkpdf-reminder-days") || '["monday","wednesday","friday"]')
  );
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleNotifications = async () => {
    if (isToggling) return; // Prevent double-clicks
    setIsToggling(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        const success = await subscribe();
        if (success) {
          // Schedule a test reminder in 5 seconds
          scheduleStudyReminder(
            "Welcome to TalkPDF! 📚",
            "You'll receive study reminders to help you stay on track.",
            5000
          );
        }
      }
    } finally {
      setIsToggling(false);
    }
  };

  const saveReminderSettings = () => {
    localStorage.setItem("talkpdf-reminder-time", reminderTime);
    localStorage.setItem("talkpdf-reminder-days", JSON.stringify(reminderDays));
    toast.success("Reminder settings saved!");
  };

  const testReminder = () => {
    if (isSubscribed) {
      scheduleStudyReminder(
        "Time to study! 📖",
        "You have documents waiting for you. Let's practice with Explain-Back!",
        1000
      );
      toast.info("Test notification will appear in 1 second");
    } else {
      toast.error("Enable notifications first");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="bg-secondary/30 rounded-xl p-6 text-center">
        <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h4 className="font-medium text-foreground mb-2">Notifications Not Supported</h4>
        <p className="text-sm text-muted-foreground">
          Your browser doesn't support push notifications. Try using Chrome, Edge, or Safari on a recent version.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">Study Reminders</p>
            <p className="text-sm text-muted-foreground">
              {isSubscribed ? "You'll receive study reminders" : "Enable to get study reminders"}
            </p>
          </div>
        </div>
        <Switch
          checked={isSubscribed}
          onCheckedChange={handleToggleNotifications}
          disabled={isToggling}
        />
      </div>

      {isSubscribed && (
        <>
          <div className="space-y-4 p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Reminder Time</Label>
            </div>
            
            <Select value={reminderTime} onValueChange={setReminderTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="08:00">8:00 AM</SelectItem>
                <SelectItem value="12:00">12:00 PM</SelectItem>
                <SelectItem value="16:00">4:00 PM</SelectItem>
                <SelectItem value="18:00">6:00 PM (Recommended)</SelectItem>
                <SelectItem value="20:00">8:00 PM</SelectItem>
                <SelectItem value="21:00">9:00 PM</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Reminder Days</Label>
              <div className="flex flex-wrap gap-2">
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                  <button
                    key={day}
                    onClick={() => {
                      setReminderDays((prev) =>
                        prev.includes(day)
                          ? prev.filter((d) => d !== day)
                          : [...prev, day]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      reminderDays.includes(day)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={saveReminderSettings} className="w-full">
              Save Settings
            </Button>
          </div>

          <Button variant="outline" onClick={testReminder} className="w-full gap-2">
            <Bell className="h-4 w-4" />
            Send Test Notification
          </Button>
        </>
      )}
    </div>
  );
};

export default NotificationSettings;
