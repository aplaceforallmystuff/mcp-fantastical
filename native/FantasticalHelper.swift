import EventKit
import Foundation

let store = EKEventStore()
let sema = DispatchSemaphore(value: 0)
let args = CommandLine.arguments
let command = args.count > 1 ? args[1] : "today"
let param = args.count > 2 ? args[2] : "7"

func toISO(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    return formatter.string(from: date)
}

func formatDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

store.requestFullAccessToEvents { granted, error in
    guard granted else {
        let errorResult = ["error": "Calendar access denied. Grant Full Calendar Access in System Settings > Privacy & Security > Calendars."]
        if let data = try? JSONSerialization.data(withJSONObject: errorResult),
           let str = String(data: data, encoding: .utf8) {
            print(str)
        }
        sema.signal()
        return
    }
    
    let cal = Calendar.current
    
    switch command {
    case "today":
        let start = cal.startOfDay(for: Date())
        guard let end = cal.date(byAdding: .day, value: 1, to: start) else {
            print("{\"error\": \"Date calculation failed\"}")
            sema.signal()
            return
        }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: pred).sorted { $0.startDate < $1.startDate }
        
        var result: [[String: String]] = []
        for evt in events {
            result.append([
                "title": evt.title ?? "",
                "calendar": evt.calendar.title,
                "start": toISO(evt.startDate),
                "end": toISO(evt.endDate),
                "location": evt.location ?? ""
            ])
        }
        
        let output: [String: Any] = [
            "date": formatDate(Date()),
            "count": events.count,
            "events": result
        ]
        if let data = try? JSONSerialization.data(withJSONObject: output),
           let str = String(data: data, encoding: .utf8) {
            print(str)
        }
        
    case "upcoming":
        let days = Int(param) ?? 7
        let start = cal.startOfDay(for: Date())
        guard let end = cal.date(byAdding: .day, value: days, to: start) else {
            print("{\"error\": \"Date calculation failed\"}")
            sema.signal()
            return
        }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: pred).sorted { $0.startDate < $1.startDate }
        
        var result: [[String: String]] = []
        for evt in events {
            result.append([
                "title": evt.title ?? "",
                "calendar": evt.calendar.title,
                "start": toISO(evt.startDate),
                "end": toISO(evt.endDate),
                "location": evt.location ?? ""
            ])
        }
        
        let output: [String: Any] = [
            "range": [
                "start": formatDate(start),
                "end": formatDate(end),
                "days": days
            ],
            "count": events.count,
            "events": result
        ]
        if let data = try? JSONSerialization.data(withJSONObject: output),
           let str = String(data: data, encoding: .utf8) {
            print(str)
        }
        
    case "calendars":
        let cals = store.calendars(for: .event)
        let result = cals.map { ["name": $0.title, "id": $0.calendarIdentifier] }
        let output: [String: Any] = ["count": cals.count, "calendars": result]
        if let data = try? JSONSerialization.data(withJSONObject: output),
           let str = String(data: data, encoding: .utf8) {
            print(str)
        }
        
    default:
        print("{\"error\": \"Unknown command. Use: today, upcoming [days], calendars\"}")
    }
    
    sema.signal()
}

sema.wait()
