// Quality-targeted transcode (Apple VideoToolbox): qenc <in> <out> <hevc|h264> <quality 0–1>
// Keeps size, frame rate and timing; spends bits where the picture changes.
import AVFoundation
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let track = asset.tracks(withMediaType: .video)[0]
let size = track.naturalSize
let reader = try! AVAssetReader(asset: asset)
let ro = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
reader.add(ro); reader.startReading()
let out = URL(fileURLWithPath: a[2]); try? FileManager.default.removeItem(at: out)
let w = try! AVAssetWriter(outputURL: out, fileType: .mp4)
let hevc = a[3] == "hevc"
var comp: [String: Any] = [AVVideoQualityKey: Double(a[4])!, AVVideoExpectedSourceFrameRateKey: 60, AVVideoMaxKeyFrameIntervalKey: 240, AVVideoAllowFrameReorderingKey: true]
if !hevc { comp[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel }
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: hevc ? AVVideoCodecType.hevc : AVVideoCodecType.h264,
  AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height),
  AVVideoCompressionPropertiesKey: comp,
  AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
input.expectsMediaDataInRealTime = false
w.add(input); w.startWriting(); w.startSession(atSourceTime: .zero)
let q = DispatchQueue(label: "enc"); let sem = DispatchSemaphore(value: 0)
input.requestMediaDataWhenReady(on: q) {
  while input.isReadyForMoreMediaData {
    if let sb = ro.copyNextSampleBuffer() { input.append(sb) } else { input.markAsFinished(); w.finishWriting { sem.signal() }; return }
  }
}
sem.wait()
print(a[2].split(separator: "/").last!, w.status == .completed ? "ok" : "failed \(w.error?.localizedDescription ?? "")")
