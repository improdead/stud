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
	4. Click the Stud button to connect
]]

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local PLUGIN_NAME = "Stud"
local POLL_URL = "http://localhost:3001/stud/poll"
local RESPOND_URL = "http://localhost:3001/stud/respond"

-- State
local isConnected = false
local isConnecting = false
local pollingEnabled = false

-- UI Elements
local toolbar = plugin:CreateToolbar(PLUGIN_NAME)
local toggleButton = toolbar:CreateButton(
	"Stud",
	"Connect to Stud AI",
	"rbxassetid://4458901886"
)

-- Colors
local Colors = {
	bg = Color3.fromRGB(25, 25, 28),
	disconnected = Color3.fromRGB(255, 85, 85),
	connecting = Color3.fromRGB(255, 170, 50),
	connected = Color3.fromRGB(85, 255, 127),
	text = Color3.fromRGB(220, 220, 220),
	textDim = Color3.fromRGB(140, 140, 140),
}

-- Widget UI
local widget
local statusDot
local statusText
local subText

local function createWidget()
	local info = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Float,
		true,  -- Initially enabled
		false, -- Override previous state
		240,   -- Width
		80,    -- Height
		200,   -- Min width
		70     -- Min height
	)
	
	widget = plugin:CreateDockWidgetPluginGui("StudConnection", info)
	widget.Title = "Stud"
	widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	
	-- Main container
	local container = Instance.new("Frame")
	container.Name = "Container"
	container.Size = UDim2.new(1, 0, 1, 0)
	container.BackgroundColor3 = Colors.bg
	container.BorderSizePixel = 0
	container.Parent = widget
	
	-- Padding
	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 12)
	padding.PaddingBottom = UDim.new(0, 12)
	padding.PaddingLeft = UDim.new(0, 16)
	padding.PaddingRight = UDim.new(0, 16)
	padding.Parent = container
	
	-- Status row
	local statusRow = Instance.new("Frame")
	statusRow.Name = "StatusRow"
	statusRow.Size = UDim2.new(1, 0, 0, 24)
	statusRow.BackgroundTransparency = 1
	statusRow.Parent = container
	
	-- Status dot (indicator)
	statusDot = Instance.new("Frame")
	statusDot.Name = "Dot"
	statusDot.Size = UDim2.new(0, 12, 0, 12)
	statusDot.Position = UDim2.new(0, 0, 0.5, -6)
	statusDot.BackgroundColor3 = Colors.disconnected
	statusDot.BorderSizePixel = 0
	statusDot.Parent = statusRow
	
	local dotCorner = Instance.new("UICorner")
	dotCorner.CornerRadius = UDim.new(1, 0)
	dotCorner.Parent = statusDot
	
	-- Status text
	statusText = Instance.new("TextLabel")
	statusText.Name = "Status"
	statusText.Size = UDim2.new(1, -20, 1, 0)
	statusText.Position = UDim2.new(0, 20, 0, 0)
	statusText.BackgroundTransparency = 1
	statusText.TextColor3 = Colors.text
	statusText.Text = "Disconnected"
	statusText.TextSize = 16
	statusText.Font = Enum.Font.GothamBold
	statusText.TextXAlignment = Enum.TextXAlignment.Left
	statusText.Parent = statusRow
	
	-- Sub text (instructions)
	subText = Instance.new("TextLabel")
	subText.Name = "SubText"
	subText.Size = UDim2.new(1, 0, 0, 20)
	subText.Position = UDim2.new(0, 0, 0, 32)
	subText.BackgroundTransparency = 1
	subText.TextColor3 = Colors.textDim
	subText.Text = "Click toolbar button to connect"
	subText.TextSize = 12
	subText.Font = Enum.Font.Gotham
	subText.TextXAlignment = Enum.TextXAlignment.Left
	subText.TextWrapped = true
	subText.Parent = container
	
	return widget
end

local function updateUI()
	if isConnecting then
		statusDot.BackgroundColor3 = Colors.connecting
		statusText.Text = "Connecting..."
		subText.Text = "Looking for Stud Desktop"
		toggleButton:SetActive(true)
	elseif isConnected then
		statusDot.BackgroundColor3 = Colors.connected
		statusText.Text = "Connected"
		subText.Text = "Ready for AI commands"
		toggleButton:SetActive(true)
	else
		statusDot.BackgroundColor3 = Colors.disconnected
		statusText.Text = "Disconnected"
		subText.Text = "Click toolbar button to connect"
		toggleButton:SetActive(false)
	end
end

-- Utility functions
local function jsonEncode(data)
	return HttpService:JSONEncode(data)
end

local function jsonDecode(str)
	return HttpService:JSONDecode(str)
end

local function getInstanceFromPath(path)
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
	
	local props = {}
	local commonProps = {"Name", "ClassName", "Parent"}
	
	if instance:IsA("BasePart") then
		local partProps = {"Position", "Size", "CFrame", "Anchored", "CanCollide", "Transparency", "BrickColor", "Material"}
		for _, p in ipairs(partProps) do
			table.insert(commonProps, p)
		end
	end
	
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
	
	if value == "true" then
		value = true
	elseif value == "false" then
		value = false
	elseif tonumber(value) then
		value = tonumber(value)
	elseif string.match(value, "^%d+,%s*%d+,%s*%d+$") then
		local parts = string.split(value, ",")
		local a, b, c = tonumber(parts[1]), tonumber(parts[2]), tonumber(parts[3])
		if a and b and c then
			if a <= 255 and b <= 255 and c <= 255 and string.find(data.property, "Color") then
				value = Color3.fromRGB(a, b, c)
			else
				value = Vector3.new(a, b, c)
			end
		end
	elseif string.match(value, "^#%x%x%x%x%x%x$") then
		local r = tonumber(string.sub(value, 2, 3), 16)
		local g = tonumber(string.sub(value, 4, 5), 16)
		local b = tonumber(string.sub(value, 6, 7), 16)
		value = Color3.fromRGB(r, g, b)
	elseif string.match(value, "^Enum%.") then
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

handlers["/instance/move"] = function(data)
	local instance = getInstanceFromPath(data.path)
	if not instance then
		error("Instance not found: " .. data.path)
	end
	
	local newParent = getInstanceFromPath(data.newParent)
	if not newParent then
		error("Parent not found: " .. data.newParent)
	end
	
	instance.Parent = newParent
	
	return { path = getInstancePath(instance) }
end

handlers["/instance/bulk-create"] = function(data)
	local created = {}
	
	for _, item in ipairs(data.instances) do
		local parent = getInstanceFromPath(item.parent)
		if parent then
			local instance = Instance.new(item.className)
			if item.name then
				instance.Name = item.name
			end
			instance.Parent = parent
			table.insert(created, getInstancePath(instance))
		end
	end
	
	return { created = created }
end

handlers["/instance/bulk-delete"] = function(data)
	local deleted = {}
	
	for _, path in ipairs(data.paths) do
		local instance = getInstanceFromPath(path)
		if instance then
			local fullPath = getInstancePath(instance)
			instance:Destroy()
			table.insert(deleted, fullPath)
		end
	end
	
	return { deleted = deleted }
end

handlers["/instance/bulk-set"] = function(data)
	local updated = 0
	local errors = {}
	
	for _, op in ipairs(data.operations) do
		local instance = getInstanceFromPath(op.path)
		if not instance then
			table.insert(errors, "Not found: " .. op.path)
		else
			local success, err = pcall(function()
				local value = op.value
				
				-- Parse value based on type
				if value == "true" then
					value = true
				elseif value == "false" then
					value = false
				elseif tonumber(value) then
					value = tonumber(value)
				elseif string.match(value, "^%d+,%s*%d+,%s*%d+$") then
					local parts = string.split(value, ",")
					local a, b, c = tonumber(parts[1]), tonumber(parts[2]), tonumber(parts[3])
					if a and b and c then
						if a <= 255 and b <= 255 and c <= 255 and string.find(op.property, "Color") then
							value = Color3.fromRGB(a, b, c)
						else
							value = Vector3.new(a, b, c)
						end
					end
				elseif string.match(value, "^#%x%x%x%x%x%x$") then
					local r = tonumber(string.sub(value, 2, 3), 16)
					local g = tonumber(string.sub(value, 4, 5), 16)
					local b = tonumber(string.sub(value, 6, 7), 16)
					value = Color3.fromRGB(r, g, b)
				elseif string.match(value, "^Enum%.") then
					local parts = string.split(value, ".")
					if #parts == 3 then
						local enumType = Enum[parts[2]]
						if enumType then
							value = enumType[parts[3]]
						end
					end
				end
				
				instance[op.property] = value
			end)
			
			if success then
				updated = updated + 1
			else
				table.insert(errors, op.path .. "." .. op.property .. ": " .. tostring(err))
			end
		end
	end
	
	return { updated = updated, errors = errors }
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

-- Paths that modify the game and should create undo waypoints
local modifyingPaths = {
	["/script/set"] = true,
	["/script/edit"] = true,
	["/instance/set"] = true,
	["/instance/create"] = true,
	["/instance/delete"] = true,
	["/instance/clone"] = true,
	["/instance/move"] = true,
	["/instance/bulk-create"] = true,
	["/instance/bulk-delete"] = true,
	["/instance/bulk-set"] = true,
	["/code/run"] = true,
}

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
	
	-- Create undo waypoint for modifying operations
	local isModifying = modifyingPaths[path]
	if isModifying then
		ChangeHistoryService:SetWaypoint("Stud: " .. path)
	end
	
	local success, result = pcall(handler, data)
	if not success then
		return {
			status = 500,
			body = jsonEncode({ error = tostring(result) })
		}
	end
	
	-- Commit the change so it can be undone
	if isModifying then
		ChangeHistoryService:SetWaypoint("Stud: " .. path .. " (done)")
	end
	
	return {
		status = 200,
		body = jsonEncode(result)
	}
end

-- Polling loop
local function pollServer()
	local failCount = 0
	local maxFails = 3
	
	while pollingEnabled do
		local success, response = pcall(function()
			return HttpService:RequestAsync({
				Url = POLL_URL,
				Method = "GET",
			})
		end)
		
		if success and response.Success then
			-- Connected!
			if not isConnected then
				isConnected = true
				isConnecting = false
				failCount = 0
				updateUI()
				print("[Stud] Connected to Stud Desktop")
			end
			
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
			failCount = 0
		else
			failCount = failCount + 1
			if isConnected and failCount >= maxFails then
				isConnected = false
				isConnecting = true
				updateUI()
				print("[Stud] Connection lost, retrying...")
			end
		end
		
		task.wait(0.1)
	end
	
	-- Stopped polling
	isConnected = false
	isConnecting = false
	updateUI()
end

-- Toggle connection
local function toggleConnection()
	pollingEnabled = not pollingEnabled
	
	if pollingEnabled then
		isConnecting = true
		updateUI()
		print("[Stud] Connecting...")
		task.spawn(pollServer)
	else
		isConnected = false
		isConnecting = false
		updateUI()
		print("[Stud] Disconnected")
	end
end

-- Initialize
createWidget()
updateUI()

toggleButton.Click:Connect(toggleConnection)

-- Show widget when button clicked
toggleButton.Click:Connect(function()
	widget.Enabled = true
end)

print("[Stud] Plugin loaded - Click the Stud button to connect")
