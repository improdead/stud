import { splitProps, type ComponentProps } from "solid-js"

const icons: Record<string, string> = {
  Script: `<path d="M3 2h7l3 3v9H3V2z" fill="#4B9CD3"/><path d="M10 2l3 3h-3V2z" fill="#3A7CA5"/><path d="M5 7h6M5 9h6M5 11h4" stroke="white" stroke-width="1"/>`,
  LocalScript: `<path d="M3 2h7l3 3v9H3V2z" fill="#4EC9B0"/><path d="M10 2l3 3h-3V2z" fill="#3BA38A"/><path d="M5 7h6M5 9h6M5 11h4" stroke="white" stroke-width="1"/>`,
  ModuleScript: `<path d="M3 2h7l3 3v9H3V2z" fill="#C586C0"/><path d="M10 2l3 3h-3V2z" fill="#9B5D97"/><path d="M5 7h6M5 9h6M5 11h4" stroke="white" stroke-width="1"/>`,
  Folder: `<path d="M2 3h12v10H2V3z" fill="#DCB67A"/><path d="M2 3h12v3H2V3z" fill="#C9A356"/>`,
  Workspace: `<rect x="2" y="2" width="12" height="12" fill="#6B8E23" rx="1"/><path d="M8 4v3l2.5-1.5L8 4z" fill="#8FBC8F"/><path d="M4 10h8M4 12h5" stroke="#8FBC8F" stroke-width="0.8"/>`,
  ServerScriptService: `<path d="M3 2h7l3 3v9H3V2z" fill="#4B9CD3"/><path d="M10 2l3 3h-3V2z" fill="#3A7CA5"/><path d="M6 7l2 1.5L6 10" stroke="white" stroke-width="1" stroke-linecap="round"/><path d="M10 7l-2 1.5L10 10" stroke="white" stroke-width="1" stroke-linecap="round"/>`,
  ServerStorage: `<rect x="2" y="4" width="12" height="9" fill="#708090" rx="1"/><rect x="4" y="6" width="3" height="2" fill="#B0C4DE"/><rect x="9" y="6" width="3" height="2" fill="#B0C4DE"/><rect x="4" y="10" width="8" height="1" fill="#B0C4DE"/>`,
  ReplicatedStorage: `<rect x="2" y="3" width="12" height="10" fill="#4682B4" rx="1"/><path d="M5 6h6M5 9h4" stroke="white" stroke-width="1"/><circle cx="12" cy="6" r="1.5" fill="#90EE90"/>`,
  ReplicatedFirst: `<rect x="2" y="3" width="12" height="10" fill="#4682B4" rx="1"/><path d="M5 7l2 2-2 2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11h2" stroke="white" stroke-width="1.2" stroke-linecap="round"/>`,
  StarterGui: `<rect x="3" y="2" width="10" height="12" fill="#5B9BD5" rx="1"/><rect x="5" y="4" width="6" height="4" fill="#B4D7F0"/><rect x="5" y="9" width="6" height="1" fill="#B4D7F0"/><rect x="5" y="11" width="4" height="1" fill="#B4D7F0"/>`,
  StarterPlayer: `<circle cx="8" cy="4.5" r="2.5" fill="#6495ED"/><path d="M4 13c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="#6495ED"/>`,
  StarterPack: `<rect x="3" y="2" width="10" height="12" fill="#708090" rx="1"/><rect x="5" y="4" width="6" height="3" fill="#B0C4DE"/><circle cx="6" cy="10" r="1.2" fill="#4B9CD3"/><circle cx="10" cy="10" r="1.2" fill="#4EC9B0"/>`,
  StarterPlayerScripts: `<path d="M3 2h7l3 3v9H3V2z" fill="#4EC9B0"/><path d="M10 2l3 3h-3V2z" fill="#3BA38A"/><circle cx="5.5" cy="5" r="1" fill="white"/><path d="M5 7h6M5 9h6M5 11h4" stroke="white" stroke-width="1"/>`,
  StarterCharacterScripts: `<circle cx="5" cy="4" r="1.5" fill="#87CEEB"/><circle cx="11" cy="4" r="1.5" fill="#87CEEB"/><path d="M5 6c0 2 1.2 5 3 5s3-3 3-5" fill="#87CEEB"/>`,
  Lighting: `<circle cx="8" cy="4" r="2" fill="#FFD700"/><path d="M8 6v3M6 8h4" stroke="#FFD700" stroke-width="1.5"/><path d="M4 12l4-1.5 4 1.5" stroke="#FFD700" stroke-width="1.5" fill="none"/>`,
  Players: `<rect x="3" y="4" width="4" height="7" fill="#87CEEB" rx="1"/><rect x="9" y="4" width="4" height="7" fill="#87CEEB" rx="1"/><circle cx="5" cy="6" r="1" fill="white"/><circle cx="11" cy="6" r="1" fill="white"/>`,
  Part: `<rect x="2" y="4" width="12" height="8" fill="#A9A9A9" rx="1"/><rect x="3" y="5" width="10" height="6" fill="#D3D3D3"/>`,
  Model: `<path d="M8 2L2 5v6l6 3 6-3V5L8 2z" fill="#9370DB"/><path d="M8 2v9M2 5l6 3 6-3" stroke="#B8A9E1" stroke-width="0.5"/>`,
  MeshPart: `<ellipse cx="8" cy="8" rx="6" ry="4" fill="#CD853F"/><ellipse cx="8" cy="8" rx="4" ry="2.5" fill="#DEB887"/>`,
  SoundService: `<circle cx="8" cy="8" r="5" fill="#4169E1"/><circle cx="8" cy="8" r="3" fill="#6495ED"/><circle cx="8" cy="8" r="1" fill="white"/>`,
  Teams: `<rect x="2" y="5" width="5" height="5" fill="#32CD32" rx="1"/><rect x="9" y="5" width="5" height="5" fill="#FF6347" rx="1"/><path d="M7.5 7.5h1" stroke="#666" stroke-width="1"/>`,
  DataModel: `<path d="M2 4h12v8H2z" fill="#4B0082"/><path d="M4 6h3v2H4zM9 6h3v2H9zM6 10h4v1H6z" fill="#9370DB"/>`,
  Configuration: `<path d="M4 2h8l2 2v8l-2 2H4l-2-2V4l2-2z" fill="#808080"/><circle cx="8" cy="8" r="3" fill="#A9A9A9"/><circle cx="8" cy="8" r="1" fill="#D3D3D3"/>`,
  RemoteEvent: `<path d="M3 4h10v8H3V4z" fill="#FF8C00"/><path d="M5 7h2v2H5V7z" fill="white"/><path d="M9 6l2 2-2 2" stroke="white" stroke-width="1" fill="none"/>`,
  RemoteFunction: `<path d="M3 4h10v8H3V4z" fill="#9932CC"/><path d="M5 6h2v4H5V6z" fill="white"/><path d="M9 8h2" stroke="white" stroke-width="1.5"/>`,
  BindableEvent: `<path d="M3 4h10v8H3V4z" fill="#20B2AA"/><path d="M5 7h2v2H5V7z" fill="white"/><path d="M9 6l2 2-2 2" stroke="white" stroke-width="1" fill="none"/>`,
  BindableFunction: `<path d="M3 4h10v8H3V4z" fill="#3CB371"/><path d="M5 6h2v4H5V6z" fill="white"/><path d="M9 8h2" stroke="white" stroke-width="1.5"/>`,
  StringValue: `<rect x="2" y="4" width="12" height="8" fill="#6A5ACD" rx="1"/><text x="8" y="10" text-anchor="middle" fill="white" font-size="6" font-family="monospace">S</text>`,
  IntValue: `<rect x="2" y="4" width="12" height="8" fill="#4169E1" rx="1"/><text x="8" y="10" text-anchor="middle" fill="white" font-size="6" font-family="monospace">#</text>`,
  NumberValue: `<rect x="2" y="4" width="12" height="8" fill="#4169E1" rx="1"/><text x="8" y="10" text-anchor="middle" fill="white" font-size="6" font-family="monospace">N</text>`,
  BoolValue: `<rect x="2" y="4" width="12" height="8" fill="#228B22" rx="1"/><text x="8" y="10" text-anchor="middle" fill="white" font-size="6" font-family="monospace">B</text>`,
  ObjectValue: `<rect x="2" y="4" width="12" height="8" fill="#B8860B" rx="1"/><text x="8" y="10" text-anchor="middle" fill="white" font-size="6" font-family="monospace">O</text>`,
  ScreenGui: `<rect x="2" y="3" width="12" height="10" fill="#4682B4" rx="1"/><rect x="3" y="4" width="10" height="8" fill="#87CEEB" rx="0.5"/>`,
  Frame: `<rect x="2" y="3" width="12" height="10" stroke="#4682B4" stroke-width="1.5" fill="none" rx="1"/>`,
  TextLabel: `<rect x="2" y="4" width="12" height="8" fill="#4682B4" rx="1"/><path d="M4 8h8" stroke="white" stroke-width="1"/>`,
  TextButton: `<rect x="2" y="4" width="12" height="8" fill="#5B9BD5" rx="2"/><path d="M5 8h6" stroke="white" stroke-width="1"/>`,
  ImageLabel: `<rect x="2" y="4" width="12" height="8" fill="#4682B4" rx="1"/><circle cx="5" cy="7" r="1.5" fill="#87CEEB"/><path d="M7 10l2-2 3 2" stroke="#87CEEB" stroke-width="1" fill="none"/>`,
  ImageButton: `<rect x="2" y="4" width="12" height="8" fill="#5B9BD5" rx="2"/><circle cx="5" cy="7" r="1.5" fill="white"/><path d="M7 10l2-2 3 2" stroke="white" stroke-width="1" fill="none"/>`,
  Camera: `<rect x="2" y="5" width="9" height="6" fill="#708090" rx="1"/><circle cx="6.5" cy="8" r="2" fill="#B0C4DE"/><path d="M11 6l3 2-3 2V6z" fill="#708090"/>`,
  Sound: `<path d="M4 6v4h2l3 2V4L6 6H4z" fill="#4169E1"/><path d="M11 5.5c1 1 1 3 0 4" stroke="#4169E1" stroke-width="1" fill="none"/>`,
  Animation: `<circle cx="5" cy="8" r="2" fill="#FF6347"/><circle cx="11" cy="8" r="2" fill="#FF6347"/><path d="M7 8h2" stroke="#FF6347" stroke-width="1.5"/>`,
  Animator: `<circle cx="8" cy="8" r="4" fill="#FF6347"/><path d="M8 5v3l2 2" stroke="white" stroke-width="1" fill="none"/>`,
  // Default fallback
  Instance: `<rect x="3" y="3" width="10" height="10" fill="#808080" rx="1"/><rect x="5" y="5" width="6" height="6" fill="#A9A9A9" rx="0.5"/>`,
}

export type InstanceClassName = keyof typeof icons

export interface InstanceIconProps extends ComponentProps<"svg"> {
  className: string
}

export function InstanceIcon(props: InstanceIconProps) {
  const [local, rest] = splitProps(props, ["className", "class", "classList"])
  const icon = () => icons[local.className] ?? icons.Instance

  return (
    <svg
      data-component="instance-icon"
      viewBox="0 0 16 16"
      fill="none"
      classList={{
        ...(local.classList || {}),
        [local.class ?? ""]: !!local.class,
      }}
      innerHTML={icon()}
      aria-hidden="true"
      {...rest}
    />
  )
}

export function getInstanceIcon(className: string): string {
  return icons[className] ? className : "Instance"
}
