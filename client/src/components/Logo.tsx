export const Logo = () => (
    <div className="flex items-center select-none group">
        <div className="relative flex items-center">
            {/* The V Emblem */}
            <div className="w-8 h-8 mr-[-0.5rem] bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center transform -skew-x-12 group-hover:skew-x-0 transition-transform duration-300 shadow-sm">
                <span className="text-white font-black text-xl italic pr-0.5">V</span>
            </div>

            {/* The Rest of the Wordmark */}
            <span className="font-bold text-2xl tracking-tight pl-3 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 group-hover:from-blue-900 group-hover:via-purple-900 group-hover:to-blue-900 transition-all duration-300">
                irtualib
            </span>
        </div>

        {/* Connection Dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5 mt-2 animate-pulse shadow-sm shadow-blue-200"></div>
    </div>
);
