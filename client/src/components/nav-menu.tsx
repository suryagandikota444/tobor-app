import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NavMenu() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between bg-background/20 backdrop-blur-sm">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="flex flex-col gap-4 mt-8">
              <Link href="/">
                <a className="text-lg font-medium">Home</a>
              </Link>
              <Link href="/settings">
                <a className="text-lg font-medium">Settings</a>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <h1 className="text-xl font-semibold text-foreground/90">Robot Control</h1>

        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </header>
  );
}