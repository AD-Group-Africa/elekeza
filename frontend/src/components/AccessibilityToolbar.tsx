interface Props {
  calmUI: boolean
  focusMode: boolean
  onCalmToggle: () => void
  onFocusToggle: () => void
}

const AccessibilityToolbar: React.FC<Props> = ({ calmUI, focusMode, onCalmToggle, onFocusToggle }) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={onCalmToggle}
        className={`px-3 py-1 rounded ${calmUI ? 'bg-gray-300' : 'bg-blue-500 text-white'}`}
      >
        {calmUI ? 'Calm UI On' : 'Calm UI Off'}
      </button>
      <button
        onClick={onFocusToggle}
        className={`px-3 py-1 rounded ${focusMode ? 'bg-gray-300' : 'bg-green-500 text-white'}`}
      >
        {focusMode ? 'Focus Mode On' : 'Focus Mode Off'}
      </button>
    </div>
  )
}

export default AccessibilityToolbar