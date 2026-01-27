--[[
	Stud Plugin for Roblox Studio
	
	This plugin creates an HTTP server that allows Stud to communicate with
	Roblox Studio for live editing and manipulation of instances.
	
	Installation:
	1. Copy this file to your Roblox Plugins folder
	   - Windows: %LOCALAPPDATA%\Roblox\Plugins
	   - Mac: ~/Documents/Roblox/Plugins
	2. Restart Roblox Studio
	3. Enable HTTP requests in Game Settings > Security
	4. The plugin will start listening for Stud connections
]]

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ScriptEditorService = game:GetService("ScriptEditorService")

local PORT = 3002
local PLUGIN_NAME = "Stud"

-- Create toolbar and button
local toolbar = plugin:CreateToolbar(PLUGIN_NAME)
local toggleButton = toolbar:CreateButton(
	"Toggle Server",
	"Enable/disable Stud connection",
	"rbxassetid://4458901886"
)

local serverEnabled = true
local statusLabel = nil

-- Utility functions
local function jsonEncode(data)
	return HttpService:JSONEncode(data)
end

local function jsonDecode(str)
	return HttpService:JSONDecode(str)
end

local function getInstanceFromPath(path)
	-- Parse paths like "game.Workspace.Part" or "game.ServerScriptService.Script"
	local parts = string.split(path, ".")
	if #parts < 2 or parts[1] ~= "game" then
		return nil
	end
	
	local current = game
	for i = 2, #parts do
		local child = current:FindFirstChild(parts[i])
		if not child then
			return nil
		end
		current = child
	end
	
	return current
end

local function getInstancePath(instance)
	local parts = {}
	local current = instance
	while current and current ~= game do
		table.insert(parts, 1, current.Name)
		current = current.Parent
	end
	return "game." .. table.concat(parts, ".")
end

local function instanceToInfo(instance, includeChildren)
	local info = {
		path = getInstancePath(instance),
		name = instance.Name,
		className = instance.ClassName,
	}
	
	if includeChildren then
		info.children = {}
		for _, child in ipairs(instance:GetChildren()) do
			table.insert(info.children, instanceToInfo(child, false))
		end
	end
	
	return info
end

-- Request handlers
local handlers = {}

handlers["/ping"] = function()
	return { status = "ok", plugin = PLUGIN_NAME }
end

handlers["/script/get"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	if not instance:IsA("LuaSourceContainer") then
		error("Not a script: " .. data.path)
	end
	
	local source = ScriptEditorService:GetEditorSource(instance)
	if not source then
		source = instance.Source
	end
	
	return {
		path = getInstancePath(instance),
		source = source,
		className = instance.ClassName,
	}
end

handlers["/script/set"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	if not instance:IsA("LuaSourceContainer") then
		error("Not a script: " .. data.path)
	end
	
	ScriptEditorService:UpdateSourceAsync(instance, function()
		return data.source
	end)
	
	return { path = getInstancePath(instance) }
end

handlers["/script/edit"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	if not instance:IsA("LuaSourceContainer") then
		error("Not a script: " .. data.path)
	end
	
	local source = ScriptEditorService:GetEditorSource(instance)
	if not source then
		source = instance.Source
	end
	
	local newSource, count = string.gsub(source, data.oldCode, data.newCode)
	if count == 0 then
		error("Code not found in script")
	end
	
	ScriptEditorService:UpdateSourceAsync(instance, function()
		return newSource
	end)
	
	return { path = getInstancePath(instance), replaced = count }
end

handlers["/instance/children"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	local children = {}
	
	if data.recursive then
		for _, child in ipairs(instance:GetDescendants()) do
			table.insert(children, instanceToInfo(child, false))
		end
	else
		for _, child in ipairs(instance:GetChildren()) do
			table.insert(children, instanceToInfo(child, false))
		end
	end
	
	return children
end

handlers["/instance/properties"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	-- Get common properties based on class
	local props = {}
	local commonProps = {"Name", "ClassName", "Parent"}
	
	-- Add BasePart properties
	if instance:IsA("BasePart") then
		local partProps = {"Position", "Size", "CFrame", "Anchored", "CanCollide", "Transparency", "BrickColor", "Material"}
		for _, p in ipairs(partProps) do
			table.insert(commonProps, p)
		end
	end
	
	-- Add GuiObject properties
	if instance:IsA("GuiObject") then
		local guiProps = {"Position", "Size", "Visible", "BackgroundColor3", "BackgroundTransparency"}
		for _, p in ipairs(guiProps) do
			table.insert(commonProps, p)
		end
	end
	
	for _, propName in ipairs(commonProps) do
		local success, value = pcall(function()
			return instance[propName]
		end)
		if success then
			table.insert(props, {
				name = propName,
				value = tostring(value),
				type = typeof(value),
			})
		end
	end
	
	return props
end

handlers["/instance/set"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	local value = data.value
	
	-- Try to parse the value based on common types
	if value == "true" then
		value = true
	elseif value == "false" then
		value = false
	elseif tonumber(value) then
		value = tonumber(value)
	elseif string.match(value, "^%d+,%s*%d+,%s*%d+$") then
		-- Vector3 or Color3
		local parts = string.split(value, ",")
		local a, b, c = tonumber(parts[1]), tonumber(parts[2]), tonumber(parts[3])
		if a and b and c then
			-- Determine if it's a color (0-255 range) or vector
			if a <= 255 and b <= 255 and c <= 255 and string.find(data.property, "Color") then
				value = Color3.fromRGB(a, b, c)
			else
				value = Vector3.new(a, b, c)
			end
		end
	elseif string.match(value, "^#%x%x%x%x%x%x$") then
		-- Hex color
		local r = tonumber(string.sub(value, 2, 3), 16)
		local g = tonumber(string.sub(value, 4, 5), 16)
		local b = tonumber(string.sub(value, 6, 7), 16)
		value = Color3.fromRGB(r, g, b)
	elseif string.match(value, "^Enum%.") then
		-- Enum value
		local parts = string.split(value, ".")
		if #parts == 3 then
			local enumType = Enum[parts[2]]
			if enumType then
				value = enumType[parts[3]]
			end
		end
	end
	
	instance[data.property] = value
	
	return { path = getInstancePath(instance) }
end

handlers["/instance/create"] = function(data)
	local parent = getInstanceFromPath(data.parent)
	if not parent then
		error("Parent not found: " .. data.parent)
	end
	
	local instance = Instance.new(data.className)
	if data.name then
		instance.Name = data.name
	end
	instance.Parent = parent
	
	return { path = getInstancePath(instance) }
end

handlers["/instance/delete"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	local path = getInstancePath(instance)
	instance:Destroy()
	
	return { deleted = path }
end

handlers["/instance/clone"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	local clone = instance:Clone()
	
	if data.parent then
		local parent = getInstanceFromPath(data.parent)
		if parent then
			clone.Parent = parent
		else
			error("Parent not found: " .. data.parent)
		end
	else
		clone.Parent = instance.Parent
	end
	
	return { path = getInstancePath(clone) }
end

handlers["/instance/search"] = function(data)
	local root = getInstanceFromPath(data.root or "game")
	if not root then
		error("Root not found: " .. (data.root or "game"))
	end
	
	local results = {}
	local limit = data.limit or 50
	
	for _, instance in ipairs(root:GetDescendants()) do
		if #results >= limit then
			break
		end
		
		local matches = true
		
		if data.name then
			matches = matches and string.lower(instance.Name):find(string.lower(data.name), 1, true) ~= nil
		end
		
		if data.className then
			matches = matches and instance.ClassName == data.className
		end
		
		if matches then
			table.insert(results, instanceToInfo(instance, false))
		end
	end
	
	return results
end

handlers["/selection/get"] = function()
	local selected = Selection:Get()
	local results = {}
	
	for _, instance in ipairs(selected) do
		table.insert(results, instanceToInfo(instance, false))
	end
	
	return results
end

handlers["/code/run"] = function(data)
	local output = {}
	
	-- Capture print output
	local oldPrint = print
	print = function(...)
		local args = {...}
		local str = ""
		for i, v in ipairs(args) do
			if i > 1 then str = str .. "\t" end
			str = str .. tostring(v)
		end
		table.insert(output, str)
	end
	
	local success, result = pcall(function()
		local fn, err = loadstring(data.code)
		if not fn then
			error(err)
		end
		return fn()
	end)
	
	print = oldPrint
	
	if not success then
		return { output = table.concat(output, "\n"), error = tostring(result) }
	end
	
	if result ~= nil then
		table.insert(output, tostring(result))
	end
	
	return { output = table.concat(output, "\n") }
end

-- HTTP request handler
local function handleRequest(request)
	local path = request.path or request.Path
	local body = request.body or request.Body
	
	local handler = handlers[path]
	if not handler then
		return {
			status = 404,
			body = jsonEncode({ error = "Not found: " .. path })
		}
	end
	
	local data = {}
	if body and body ~= "" then
		local success, parsed = pcall(jsonDecode, body)
		if success then
			data = parsed
		end
	end
	
	local success, result = pcall(handler, data)
	if not success then
		return {
			status = 500,
			body = jsonEncode({ error = tostring(result) })
		}
	end
	
	return {
		status = 200,
		body = jsonEncode(result)
	}
end

-- Polling mechanism for communication with Stud desktop app
-- The desktop app runs a local server that this plugin polls for requests
local pollingEnabled = false
local POLL_URL = "http://localhost:3001/stud/poll"
local RESPOND_URL = "http://localhost:3001/stud/respond"

local function pollServer()
	while pollingEnabled do
		local success, response = pcall(function()
			return HttpService:RequestAsync({
				Url = POLL_URL,
				Method = "GET",
			})
		end)
		
		if success and response.Success then
			local data = jsonDecode(response.Body)
			if data and data.request then
				local result = handleRequest(data.request)
				pcall(function()
					HttpService:RequestAsync({
						Url = RESPOND_URL,
						Method = "POST",
						Headers = { ["Content-Type"] = "application/json" },
						Body = jsonEncode({
							id = data.id,
							response = result,
						}),
					})
				end)
			end
		end
		
		task.wait(0.1)
	end
end

-- Create status widget
local function createWidget()
	local widgetInfo = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Float,
		false,
		false,
		200,
		100,
		150,
		80
	)
	
	local widget = plugin:CreateDockWidgetPluginGui("StudStatus", widgetInfo)
	widget.Title = "Stud"
	
	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(1, 0, 1, 0)
	frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	frame.Parent = widget
	
	statusLabel = Instance.new("TextLabel")
	statusLabel.Size = UDim2.new(1, -20, 1, -20)
	statusLabel.Position = UDim2.new(0, 10, 0, 10)
	statusLabel.BackgroundTransparency = 1
	statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
	statusLabel.Text = "Stud: Ready"
	statusLabel.TextSize = 14
	statusLabel.Font = Enum.Font.SourceSans
	statusLabel.Parent = frame
	
	return widget
end

-- Initialize
local widget = createWidget()

toggleButton.Click:Connect(function()
	serverEnabled = not serverEnabled
	pollingEnabled = serverEnabled
	
	if statusLabel then
		statusLabel.Text = serverEnabled and "Stud: Ready" or "Stud: Disabled"
	end
	
	if pollingEnabled then
		task.spawn(pollServer)
	end
end)

print("[Stud] Plugin loaded - Ready for connections")
