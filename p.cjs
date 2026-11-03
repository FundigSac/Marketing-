const fs=require("fs");
function rep(f,a,b){let c=fs.readFileSync(f,"utf8");if(!c.includes(a))throw new Error("nomatch "+f+" :: "+a.slice(0,50));fs.writeFileSync(f,c.replace(a,b));}
const sh="src/components/app-shell.tsx";
rep(sh,`{active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-secondary" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}`,`{active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg border border-border bg-accent shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_6%,transparent)]" transition={{ type: "spring", stiffness: 600, damping: 45 }}><span className="absolute inset-y-2 -left-2.5 w-[3px] rounded-r-full bg-brand" /></motion.span>}`);
rep(sh,`${'$'}{active ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`,`${'$'}{active ? "text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`);
rep(sh,`className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex"`,`className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background/80 backdrop-blur transition-[width] duration-200 lg:flex"`);
rep(sh,`${'$'}{active ? "text-primary" : "text-muted-foreground"}\`}>`,`${'$'}{active ? "text-foreground" : "text-muted-foreground"}\`}>`);
rep(sh,`className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-primary"`,`className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-brand"`);
rep("src/app/ideas/page.tsx","<Card className={`flex h-full flex-col gap-4 p-5 ","<Card className={`surface-hover flex h-full flex-col gap-4 p-5 ");
