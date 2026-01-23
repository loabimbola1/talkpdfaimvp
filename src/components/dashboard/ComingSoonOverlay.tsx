import { Clock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ComingSoonOverlayProps {
  featureName: string;
  description?: string;
  onNotify?: () => void;
}

export const ComingSoonOverlay = ({ 
  featureName, 
  description = "We're working hard to bring you this feature. Stay tuned!",
  onNotify 
}: ComingSoonOverlayProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full border-dashed border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="h-10 w-10 text-primary animate-pulse" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold text-foreground">
              Coming Soon
            </h3>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          
          <p className="text-xl font-semibold text-primary mb-4">
            {featureName}
          </p>
          
          <p className="text-muted-foreground text-sm mb-6">
            {description}
          </p>
          
          {onNotify && (
            <Button onClick={onNotify} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Notify Me When Ready
            </Button>
          )}
          
          <div className="mt-6 pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground">
              🚀 We're building something amazing for you!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoonOverlay;
