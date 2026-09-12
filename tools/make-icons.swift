// The icon rule: the raster icons are generated, they are never designed.
// assets/favicon.svg is the only source. This script re-renders /favicon.ico
// and /apple-touch-icon.png from it, so a change to the sigil means running
// this again rather than editing a binary by hand.
//
// Regenerate, from the repo root:
//     python3 -m http.server 8788 --bind 127.0.0.1 &
//     swift tools/make-icons.swift http://127.0.0.1:8788/assets/favicon.svg
//
// Why both formats exist: Safari does not treat an SVG `rel="icon"` as
// sufficient. It also asks for /favicon.ico at the site root, and it uses
// apple-touch-icon for Add to Dock, the Start Page and Home Screen. When those
// are missing it falls back to drawing the icon on a plate of its own, which
// reads as a white mask around the sigil.
//
// Why WebKit is used only for coverage: a WKWebView snapshot comes back
// through the display's wide-gamut transform, which leaves the ink untouched
// but clips light tones — paper #F4F2EC arrived as #FFFEF8. So the sigil is
// rendered white on black for its shape alone, and the profile colors are
// composited per pixel in sRGB afterwards. The colors are then exact by
// construction, not by trusting the renderer.

import AppKit
import WebKit
import ImageIO
import UniformTypeIdentifiers

let sourceURL = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "http://127.0.0.1:8788/assets/favicon.svg"

let icoSizes = [16, 32, 48]
let appleTouchSize = 180

// The two profile colors are read out of the SVG so this file never becomes a
// second, drifting definition of ink and paper.
let svgText = try String(contentsOf: URL(string: sourceURL)!, encoding: .utf8)
let fills = svgText.ranges(of: try Regex("fill=\"#([0-9A-Fa-f]{6})\"")).map { String(svgText[$0]) }
guard fills.count >= 2 else { fatalError("expected an ink fill and a paper fill in the SVG, found \(fills.count)") }

func components(of fillAttribute: String) -> (UInt8, UInt8, UInt8) {
    let hex = fillAttribute.dropFirst("fill=\"#".count).prefix(6)
    let value = UInt32(hex, radix: 16)!
    return (UInt8((value >> 16) & 0xFF), UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF))
}

let ink = components(of: fills[0])
let paper = components(of: fills[1])

let maskSVG = svgText
    .replacingOccurrences(of: fills[0], with: "fill=\"#000000\"")
    .replacingOccurrences(of: fills[1], with: "fill=\"#FFFFFF\"")

/// Renders the sigil as an 8-bit coverage mask at the given pixel size.
final class MaskRenderer: NSObject, WKNavigationDelegate {
    let size: Int
    let webView: WKWebView
    var coverage: [UInt8]?
    var done = false

    init(size: Int) {
        self.size = size
        let side = CGFloat(size * 4)
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: side, height: side))
        super.init()
    }

    func render() -> [UInt8] {
        webView.navigationDelegate = self
        // Rendered at 4x and downsampled, so small sizes keep clean edges.
        let side = size * 4
        webView.loadHTMLString("""
        <body style="margin:0;width:\(side)px;height:\(side)px;overflow:hidden">
        <style>svg{display:block;width:\(side)px;height:\(side)px}</style>
        \(maskSVG)
        </body>
        """, baseURL: nil)

        let deadline = Date().addingTimeInterval(15)
        while !done && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
        }
        guard let coverage else { fatalError("could not render the mask at \(size)px") }
        return coverage
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            webView.takeSnapshot(with: WKSnapshotConfiguration()) { image, error in
                defer { self.done = true }
                guard let image,
                      let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
                      // Gamma 2.2 rather than linear gray: coverage has to blend
                      // the way a browser composites in sRGB, or anti-aliased
                      // edges come out the wrong weight at 16px.
                      let gray = CGColorSpace(name: CGColorSpace.genericGrayGamma2_2),
                      let context = CGContext(
                          data: nil, width: self.size, height: self.size,
                          bitsPerComponent: 8, bytesPerRow: self.size, space: gray,
                          bitmapInfo: CGImageAlphaInfo.none.rawValue
                      ) else {
                    print("snapshot failed at \(self.size)px: \(String(describing: error))")
                    return
                }
                context.interpolationQuality = .high
                context.draw(source, in: CGRect(x: 0, y: 0, width: self.size, height: self.size))
                guard let data = context.data else { return }
                let buffer = data.bindMemory(to: UInt8.self, capacity: self.size * self.size)
                self.coverage = Array(UnsafeBufferPointer(start: buffer, count: self.size * self.size))
            }
        }
    }
}

/// Paper composited over ink through the coverage mask, in sRGB.
func pixels(coverage: [UInt8], size: Int) -> [UInt8] {
    var pixels = [UInt8](repeating: 0, count: size * size * 4)
    for index in 0..<(size * size) {
        let c = Double(coverage[index]) / 255.0
        pixels[index * 4 + 0] = UInt8((Double(ink.0) * (1 - c) + Double(paper.0) * c).rounded())
        pixels[index * 4 + 1] = UInt8((Double(ink.1) * (1 - c) + Double(paper.1) * c).rounded())
        pixels[index * 4 + 2] = UInt8((Double(ink.2) * (1 - c) + Double(paper.2) * c).rounded())
        pixels[index * 4 + 3] = 255
    }
    return pixels
}

func writePNG(_ pixels: [UInt8], size: Int, to path: String) {
    let provider = CGDataProvider(data: Data(pixels) as CFData)!
    let image = CGImage(
        width: size, height: size, bitsPerComponent: 8, bitsPerPixel: 32,
        bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
        provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
    )!
    let destination = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil
    )!
    CGImageDestinationAddImage(destination, image, nil)
    CGImageDestinationFinalize(destination)
    print("wrote \(path) (\(size)px)")
}

/// A 32-bit BMP DIB, the icon-directory entry format every decoder reads.
/// PNG-in-ICO is smaller but only newer decoders understand it.
func dib(_ pixels: [UInt8], size: Int) -> Data {
    var data = Data()
    func put16(_ value: Int) {
        var little = UInt16(truncatingIfNeeded: value).littleEndian
        withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
    }
    func put32(_ value: Int) {
        var little = UInt32(truncatingIfNeeded: value).littleEndian
        withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
    }

    // The AND mask goes unused because the icon is opaque, but it must be there.
    let maskBytes = ((size + 31) / 32) * 4 * size

    put32(40)                             // biSize
    put32(size)                           // biWidth
    put32(size * 2)                       // biHeight: image plus mask
    put16(1)                              // biPlanes
    put16(32)                             // biBitCount
    put32(0)                              // biCompression: BI_RGB
    put32(size * size * 4 + maskBytes)    // biSizeImage
    put32(0); put32(0); put32(0); put32(0)

    // BMP rows run bottom-up and store BGRA.
    for row in stride(from: size - 1, through: 0, by: -1) {
        for column in 0..<size {
            let index = (row * size + column) * 4
            data.append(pixels[index + 2])
            data.append(pixels[index + 1])
            data.append(pixels[index + 0])
            data.append(255)
        }
    }
    data.append(Data(repeating: 0, count: maskBytes))
    return data
}

func writeICO(_ entries: [(size: Int, payload: Data)], to path: String) {
    var ico = Data()
    func put16(_ value: Int) {
        var little = UInt16(truncatingIfNeeded: value).littleEndian
        withUnsafeBytes(of: &little) { ico.append(contentsOf: $0) }
    }
    func put32(_ value: Int) {
        var little = UInt32(truncatingIfNeeded: value).littleEndian
        withUnsafeBytes(of: &little) { ico.append(contentsOf: $0) }
    }

    put16(0)                    // reserved
    put16(1)                    // type: icon
    put16(entries.count)

    var offset = 6 + entries.count * 16
    for entry in entries {
        ico.append(UInt8(entry.size == 256 ? 0 : entry.size))
        ico.append(UInt8(entry.size == 256 ? 0 : entry.size))
        ico.append(0)           // palette size
        ico.append(0)           // reserved
        put16(1)                // color planes
        put16(32)               // bits per pixel
        put32(entry.payload.count)
        put32(offset)
        offset += entry.payload.count
    }
    for entry in entries { ico.append(entry.payload) }

    try! ico.write(to: URL(fileURLWithPath: path))
    print("wrote \(path): \(entries.map { "\($0.size)x\($0.size)" }.joined(separator: ", "))")
}

// Each renderer is held for the whole render: the web view keeps its
// navigation delegate weakly, so a temporary would be gone before the
// snapshot lands.
let icoEntries = icoSizes.map { size -> (size: Int, payload: Data) in
    let renderer = MaskRenderer(size: size)
    let coverage = renderer.render()
    return (size, dib(pixels(coverage: coverage, size: size), size: size))
}
writeICO(icoEntries, to: "favicon.ico")

let appleTouchRenderer = MaskRenderer(size: appleTouchSize)
let appleTouch = appleTouchRenderer.render()
writePNG(pixels(coverage: appleTouch, size: appleTouchSize), size: appleTouchSize, to: "apple-touch-icon.png")
