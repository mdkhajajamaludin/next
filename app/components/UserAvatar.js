export default function UserAvatar({ email }) {
    const initials = email
      ? email.split('@')[0].substring(0, 2).toUpperCase()
      : 'U';
  
    return (
      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium text-sm ring-2 ring-indigo-50">
        {initials}
      </div>
    );
  }