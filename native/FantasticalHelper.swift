import EventKit
import Foundation

// Args: <command> [<param>] [--flag value ...] [--output <path>]
//   command: today | upcoming | calendars | find | update | delete
//   param:   for 'upcoming', the number of days (default 7)
//
//   find:    --query <text>   (substring match on title, case-insensitive)
//            --days <n>        (search window ±n days, default 30)
//            --calendar <name> (optional, restrict to one calendar)
//   update:  --id <eventIdentifier>  plus any of:
//            --title <text> --start <ISO8601> --end <ISO8601>
//            --location <text> --notes <text> --calendar <name>
//   delete:  --id <eventIdentifier>  [--span thisEvent|futureEvents]
//
//   --output <path>: if given, JSON is written to this file instead of stdout.
//                    Required when launched via `open -W` because `open` detaches stdio.

let allArgs = CommandLine.arguments
var positional: [String] = []
var flags: [String: String] = [:]
var outputPath: String? = nil

var i = 1
while i < allArgs.count {
    let a = allArgs[i]
    if a == "--output", i + 1 < allArgs.count {
        outputPath = allArgs[i + 1]
        i += 2
    } else if a.hasPrefix("--"), i + 1 < allArgs.count {
        flags[String(a.dropFirst(2))] = allArgs[i + 1]
        i += 2
    } else {
        positional.append(a)
        i += 1
    }
}

let command = positional.count > 0 ? positional[0] : "today"
let param = positional.count > 1 ? positional[1] : "7"

let store = EKEventStore()
let sema = DispatchSemaphore(value: 0)

func emit(_ json: String) {
    if let path = outputPath {
        try? json.write(toFile: path, atomically: true, encoding: .utf8)
    } else {
        print(json)
    }
}

func emit(_ obj: Any) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj),
          let str = String(data: data, encoding: .utf8) else {
        emit("{\"error\":\"JSON serialization failed\"}")
        return
    }
    emit(str)
}

func toISO(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}

func parseISO(_ s: String) -> Date? {
    // Accept ISO8601 both with and without fractional seconds.
    let f1 = ISO8601DateFormatter()
    if let d = f1.date(from: s) { return d }
    let f2 = ISO8601DateFormatter()
    f2.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f2.date(from: s)
}

func formatDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

// Serialize an event including its stable identifier so callers can update/delete it.
func eventDict(_ evt: EKEvent) -> [String: String] {
    [
        "id": evt.eventIdentifier ?? "",
        "title": evt.title ?? "",
        "calendar": evt.calendar.title,
        "start": toISO(evt.startDate),
        "end": toISO(evt.endDate),
        "location": evt.location ?? "",
        "notes": evt.notes ?? ""
    ]
}

store.requestFullAccessToEvents { granted, _ in
    guard granted else {
        emit(["error": "Calendar access denied. Open System Settings > Privacy & Security > Calendars and enable FantasticalHelper."])
        sema.signal()
        return
    }

    let cal = Calendar.current

    switch command {
    case "today":
        let start = cal.startOfDay(for: Date())
        guard let end = cal.date(byAdding: .day, value: 1, to: start) else {
            emit("{\"error\":\"Date calculation failed\"}")
            sema.signal()
            return
        }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: pred).sorted { $0.startDate < $1.startDate }
        emit([
            "date": formatDate(Date()),
            "count": events.count,
            "events": events.map(eventDict)
        ] as [String: Any])

    case "upcoming":
        let days = Int(param) ?? 7
        let start = cal.startOfDay(for: Date())
        guard let end = cal.date(byAdding: .day, value: days, to: start) else {
            emit("{\"error\":\"Date calculation failed\"}")
            sema.signal()
            return
        }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: pred).sorted { $0.startDate < $1.startDate }
        emit([
            "range": [
                "start": formatDate(start),
                "end": formatDate(end),
                "days": days
            ],
            "count": events.count,
            "events": events.map(eventDict)
        ] as [String: Any])

    case "calendars":
        let cals = store.calendars(for: .event)
        let result = cals.map { ["name": $0.title, "id": $0.calendarIdentifier] }
        emit(["count": cals.count, "calendars": result] as [String: Any])

    case "find":
        // Substring search over a window (default ±30 days) so callers can locate
        // an event's identifier before updating/deleting it.
        guard let query = flags["query"], !query.isEmpty else {
            emit("{\"error\":\"find requires --query <text>\"}")
            sema.signal()
            return
        }
        let days = Int(flags["days"] ?? "30") ?? 30
        let now = Date()
        guard let start = cal.date(byAdding: .day, value: -days, to: now),
              let end = cal.date(byAdding: .day, value: days, to: now) else {
            emit("{\"error\":\"Date calculation failed\"}")
            sema.signal()
            return
        }
        var calendars: [EKCalendar]? = nil
        if let calName = flags["calendar"] {
            calendars = store.calendars(for: .event).filter { $0.title == calName }
        }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
        let q = query.lowercased()
        let events = store.events(matching: pred)
            .filter { ($0.title ?? "").lowercased().contains(q) }
            .sorted { $0.startDate < $1.startDate }
        emit([
            "query": query,
            "count": events.count,
            "events": events.map(eventDict)
        ] as [String: Any])

    case "update":
        guard let id = flags["id"], !id.isEmpty else {
            emit("{\"error\":\"update requires --id <eventIdentifier>\"}")
            sema.signal()
            return
        }
        guard let evt = store.event(withIdentifier: id) else {
            emit(["error": "No event found with id \(id)"])
            sema.signal()
            return
        }
        if let t = flags["title"] { evt.title = t }
        if let s = flags["start"] {
            guard let d = parseISO(s) else {
                emit(["error": "Invalid --start; expected ISO8601 like 2026-06-02T15:00:00Z"])
                sema.signal()
                return
            }
            evt.startDate = d
        }
        if let e = flags["end"] {
            guard let d = parseISO(e) else {
                emit(["error": "Invalid --end; expected ISO8601 like 2026-06-02T16:00:00Z"])
                sema.signal()
                return
            }
            evt.endDate = d
        }
        if let loc = flags["location"] { evt.location = loc }
        if let n = flags["notes"] { evt.notes = n }
        if let calName = flags["calendar"] {
            if let target = store.calendars(for: .event).first(where: { $0.title == calName }) {
                evt.calendar = target
            } else {
                emit(["error": "No calendar named '\(calName)'"])
                sema.signal()
                return
            }
        }
        if evt.endDate <= evt.startDate {
            emit(["error": "Event end must be after start"])
            sema.signal()
            return
        }
        do {
            try store.save(evt, span: .thisEvent, commit: true)
            emit(["success": true, "action": "updated", "event": eventDict(evt)] as [String: Any])
        } catch {
            emit(["error": "Failed to update: \(error.localizedDescription)"])
        }

    case "delete":
        guard let id = flags["id"], !id.isEmpty else {
            emit("{\"error\":\"delete requires --id <eventIdentifier>\"}")
            sema.signal()
            return
        }
        guard let evt = store.event(withIdentifier: id) else {
            emit(["error": "No event found with id \(id)"])
            sema.signal()
            return
        }
        let span: EKSpan = (flags["span"] == "futureEvents") ? .futureEvents : .thisEvent
        let summary = eventDict(evt)
        do {
            try store.remove(evt, span: span, commit: true)
            emit(["success": true, "action": "deleted", "event": summary] as [String: Any])
        } catch {
            emit(["error": "Failed to delete: \(error.localizedDescription)"])
        }

    default:
        emit("{\"error\":\"Unknown command. Use: today, upcoming [days], calendars, find, update, delete\"}")
    }

    sema.signal()
}

sema.wait()
