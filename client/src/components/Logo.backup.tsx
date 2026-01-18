export const Logo = () => (
    <div className="flex items-center select-none">
        <span className="font-black text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            virtualib
        </span>
        <div className="flex gap-0.5 ml-1 self-end mb-1.5 opacity-80">
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="w-1 h-1 rounded-full bg-purple-500" style={{ animationDelay: '150ms' }}></div>
        </div>
    </div>
);
