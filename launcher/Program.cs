using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("BanLog")]
[assembly: AssemblyDescription("BanLog 日本动画追番记录 Windows 桌面版")]
[assembly: AssemblyCompany("BanLog")]
[assembly: AssemblyProduct("BanLog")]
[assembly: AssemblyCopyright("Copyright © 2026")]
[assembly: AssemblyVersion("2.2.0.0")]
[assembly: AssemblyFileVersion("2.2.0.0")]

namespace BanLogLauncher
{
    internal static class LauncherEnvironment
    {
        private static readonly object FileLogLock = new object();

        public static readonly string BaseDir =
            Path.GetDirectoryName(Application.ExecutablePath);

        public static string AppRoot { get; private set; }
        public static string DataDir { get; private set; }
        public static string LogDir { get; private set; }
        public static string WebViewDataDir { get; private set; }
        public static string DatabasePath { get; private set; }

        public static readonly string SeedPath =
            Path.Combine(BaseDir, "seed.db");

        public static readonly string NodePath =
            Path.Combine(BaseDir, "runtime", "node.exe");

        public static readonly string ServerDir =
            Path.Combine(BaseDir, "server");

        public static readonly string ServerEntry =
            Path.Combine(ServerDir, "server.js");

        public static readonly bool DebugMode =
            string.Equals(
                Environment.GetEnvironmentVariable("BANLOG_DEBUG"),
                "1",
                StringComparison.OrdinalIgnoreCase);

        public const int DebugPort = 9223;

        public static bool IsStorageReady
        {
            get { return AppRoot != null; }
        }

        private static string PortableRoot
        {
            get { return Path.Combine(BaseDir, "BanLogData"); }
        }

        private static string LocalAppRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(
                        Environment.SpecialFolder.LocalApplicationData),
                    "BanLog");
            }
        }

        private static string RoamingAppRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(
                        Environment.SpecialFolder.ApplicationData),
                    "BanLog");
            }
        }

        private static string TempAppRoot
        {
            get
            {
                return Path.Combine(Path.GetTempPath(), "BanLog");
            }
        }

        /// <summary>
        /// 依次尝试多个可写目录。桌面便携包优先把数据放在 exe 同目录，
        /// 避免 AppData 权限/沙箱策略导致程序无法启动；若程序所在目录
        /// 只读，则回退到 LocalAppData、RoamingAppData 或临时目录。
        /// 返回 null 表示成功；失败时返回包含尝试路径的错误说明。
        /// </summary>
        public static string InitializeStorage()
        {
            if (IsStorageReady)
            {
                return null;
            }

            List<string> candidates = new List<string>();
            string overridePath =
                Environment.GetEnvironmentVariable("BANLOG_USER_DATA_DIR");

            if (!string.IsNullOrWhiteSpace(overridePath))
            {
                try
                {
                    candidates.Add(Path.GetFullPath(overridePath));
                }
                catch
                {
                    // Ignore malformed override and continue with defaults.
                }
            }

            // 旧版本曾把数据放在 LocalAppData；如果那里已经有数据库，
            // 优先沿用旧位置，避免更新后丢失已有追番记录。
            bool legacyDatabaseExists = false;
            try
            {
                legacyDatabaseExists = File.Exists(
                    Path.Combine(LocalAppRoot, "data", "banlog.db"));
            }
            catch
            {
                // Permission check is best effort.
            }

            if (legacyDatabaseExists)
            {
                AddCandidate(candidates, LocalAppRoot);
            }

            AddCandidate(candidates, PortableRoot);
            AddCandidate(candidates, LocalAppRoot);
            AddCandidate(candidates, RoamingAppRoot);
            AddCandidate(candidates, TempAppRoot);

            StringBuilder failures = new StringBuilder();
            foreach (string candidate in candidates)
            {
                try
                {
                    PrepareRoot(candidate);
                    AppRoot = candidate;
                    DataDir = Path.Combine(candidate, "data");
                    LogDir = Path.Combine(candidate, "logs");
                    WebViewDataDir = Path.Combine(candidate, "webview2-data");
                    DatabasePath = Path.Combine(DataDir, "banlog.db");

                    MigrateLegacyDatabase();
                    return null;
                }
                catch (Exception ex)
                {
                    failures.AppendLine(
                        "• " + candidate + " — " + ex.Message);
                }
            }

            return "无法创建可写的数据目录。已尝试：\r\n" + failures;
        }

        private static void AddCandidate(List<string> candidates, string path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            foreach (string existing in candidates)
            {
                if (string.Equals(
                    existing.TrimEnd('\\'),
                    path.TrimEnd('\\'),
                    StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }
            }

            candidates.Add(path);
        }

        private static void PrepareRoot(string root)
        {
            Directory.CreateDirectory(root);
            Directory.CreateDirectory(Path.Combine(root, "data"));
            Directory.CreateDirectory(Path.Combine(root, "logs"));
            Directory.CreateDirectory(Path.Combine(root, "webview2-data"));

            // 创建目录成功不代表之后能正常写入；做一次真实写探针。
            string probePath = Path.Combine(
                root,
                ".write-probe-" + Guid.NewGuid().ToString("N") + ".tmp");
            File.WriteAllText(probePath, "ok", new UTF8Encoding(false));
            File.Delete(probePath);
        }

        private static void MigrateLegacyDatabase()
        {
            try
            {
                string legacyDatabasePath = Path.Combine(
                    LocalAppRoot,
                    "data",
                    "banlog.db");

                if (string.Equals(
                    Path.GetFullPath(AppRoot),
                    Path.GetFullPath(LocalAppRoot),
                    StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                if (!File.Exists(DatabasePath) &&
                    File.Exists(legacyDatabasePath))
                {
                    Directory.CreateDirectory(DataDir);
                    File.Copy(legacyDatabasePath, DatabasePath, false);
                }
            }
            catch
            {
                // Migration is best effort; startup continues with seed DB.
            }
        }

        public static string GetLogPath(string fileName)
        {
            string logDir = LogDir;
            if (string.IsNullOrEmpty(logDir))
            {
                try
                {
                    logDir = Path.Combine(Path.GetTempPath(), "BanLog", "logs");
                    Directory.CreateDirectory(logDir);
                }
                catch
                {
                    return Path.Combine(Path.GetTempPath(), fileName);
                }
            }

            return Path.Combine(logDir, fileName);
        }

        public static void Log(string message)
        {
            try
            {
                lock (FileLogLock)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(GetLogPath("launcher.log")));
                    File.AppendAllText(
                        GetLogPath("launcher.log"),
                        "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " +
                        message + Environment.NewLine,
                        new UTF8Encoding(false));
                }
            }
            catch
            {
                // Logging must never block startup.
            }
        }
    }

    internal static class Program
    {
        private const string MutexName = @"Local\BanLogDesktopLauncher";

        [STAThread]
        private static void Main()
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show(
                        "BanLog 已经在运行中，请从任务栏打开现有窗口。",
                        "BanLog",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                try
                {
                    string storageError = LauncherEnvironment.InitializeStorage();
                    if (storageError != null)
                    {
                        MessageBox.Show(
                            "BanLog 无法创建数据目录：\r\n\r\n" +
                            storageError +
                            "\r\n\r\n请把整个程序目录解压到可写位置（例如桌面或用户目录）后再运行；" +
                            "如果使用安全软件，请允许 BanLog.exe 写入程序目录或用户数据目录。",
                            "BanLog",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error);
                        return;
                    }

                    LauncherEnvironment.Log(
                        "Desktop launcher starting. data=" +
                        LauncherEnvironment.AppRoot);
                    Application.Run(new MainForm());
                    LauncherEnvironment.Log("Desktop launcher stopped.");
                }
                catch (Exception ex)
                {
                    LauncherEnvironment.Log("Fatal launcher error: " + ex);
                    MessageBox.Show(
                        "BanLog 启动失败：\r\n" + ex.Message +
                        "\r\n\r\n日志：" + LauncherEnvironment.GetLogPath("launcher.log"),
                        "BanLog",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
                finally
                {
                    GC.KeepAlive(mutex);
                }
            }
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 _webView;
        private readonly Panel _splash;
        private readonly Panel _splashCard;
        private readonly Label _statusLabel;
        private readonly Panel _progressTrack;
        private readonly Panel _progressFill;
        private readonly System.Windows.Forms.Timer _progressTimer;
        private readonly object _serverLogLock = new object();

        private Process _serverProcess;
        private StreamWriter _serverLogWriter;
        private bool _serverLogClosed;
        private string _appUrl;
        private int _serverPort;
        private bool _startupStarted;
        private bool _shuttingDown;
        private bool _fatalErrorShown;
        private int _progressOffset;
        private int _progressDirection = 1;

        public MainForm()
        {
            Text = "BanLog";
            ClientSize = new Size(1360, 900);
            MinimumSize = new Size(980, 680);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(250, 250, 250);
            Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular);

            Icon appIcon = null;
            try
            {
                appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                // Use the default icon below.
            }
            Icon = appIcon ?? SystemIcons.Application;

            _webView = new WebView2();
            _webView.Dock = DockStyle.Fill;
            _webView.Visible = false;
            _webView.DefaultBackgroundColor = Color.FromArgb(250, 250, 250);
            Controls.Add(_webView);

            _splash = new Panel();
            _splash.Dock = DockStyle.Fill;
            _splash.BackColor = Color.FromArgb(250, 250, 250);
            Controls.Add(_splash);
            _splash.BringToFront();

            _splashCard = new Panel();
            _splashCard.Size = new Size(500, 354);
            _splashCard.BackColor = Color.White;
            _splashCard.BorderStyle = BorderStyle.FixedSingle;
            _splash.Controls.Add(_splashCard);

            Label eyebrow = new Label();
            eyebrow.Text = "BANLOG · WINDOWS";
            eyebrow.TextAlign = ContentAlignment.MiddleCenter;
            eyebrow.ForeColor = Color.FromArgb(239, 68, 68);
            eyebrow.Font = new Font("Microsoft YaHei UI", 8F, FontStyle.Bold);
            eyebrow.Location = new Point(30, 28);
            eyebrow.Size = new Size(438, 18);
            _splashCard.Controls.Add(eyebrow);

            Label seal = new Label();
            seal.Text = "B";
            seal.TextAlign = ContentAlignment.MiddleCenter;
            seal.BackColor = Color.FromArgb(23, 23, 23);
            seal.ForeColor = Color.FromArgb(250, 250, 250);
            seal.Font = new Font("Microsoft YaHei UI", 26F, FontStyle.Bold);
            seal.Location = new Point(212, 60);
            seal.Size = new Size(76, 76);
            _splashCard.Controls.Add(seal);

            Label title = new Label();
            title.Text = "BanLog";
            title.TextAlign = ContentAlignment.MiddleCenter;
            title.ForeColor = Color.FromArgb(23, 23, 23);
            title.Font = new Font("Microsoft YaHei UI", 22F, FontStyle.Bold);
            title.Location = new Point(20, 151);
            title.Size = new Size(458, 42);
            _splashCard.Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "日本动画追番记录 · AniList";
            subtitle.TextAlign = ContentAlignment.MiddleCenter;
            subtitle.ForeColor = Color.FromArgb(115, 115, 115);
            subtitle.Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular);
            subtitle.Location = new Point(20, 193);
            subtitle.Size = new Size(458, 20);
            _splashCard.Controls.Add(subtitle);

            _progressTrack = new Panel();
            _progressTrack.BackColor = Color.FromArgb(229, 229, 229);
            _progressTrack.Location = new Point(88, 233);
            _progressTrack.Size = new Size(322, 4);
            _splashCard.Controls.Add(_progressTrack);

            _progressFill = new Panel();
            _progressFill.BackColor = Color.FromArgb(23, 23, 23);
            _progressFill.Location = new Point(0, 0);
            _progressFill.Size = new Size(92, 4);
            _progressTrack.Controls.Add(_progressFill);

            _statusLabel = new Label();
            _statusLabel.Text = "正在检查运行环境…";
            _statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            _statusLabel.ForeColor = Color.FromArgb(115, 115, 115);
            _statusLabel.Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular);
            _statusLabel.Location = new Point(20, 252);
            _statusLabel.Size = new Size(458, 24);
            _splashCard.Controls.Add(_statusLabel);

            Label footnote = new Label();
            footnote.Text = "本地 SQLite · AniList";
            footnote.TextAlign = ContentAlignment.MiddleCenter;
            footnote.ForeColor = Color.FromArgb(163, 163, 163);
            footnote.Font = new Font("Microsoft YaHei UI", 8F, FontStyle.Regular);
            footnote.Location = new Point(20, 304);
            footnote.Size = new Size(458, 20);
            _splashCard.Controls.Add(footnote);

            _splash.Resize += delegate
            {
                CenterSplashCard();
            };
            CenterSplashCard();

            _progressTimer = new System.Windows.Forms.Timer();
            _progressTimer.Interval = 28;
            _progressTimer.Tick += delegate
            {
                if (_shuttingDown || _progressTrack == null || _progressFill == null)
                {
                    return;
                }

                _progressOffset += 4 * _progressDirection;
                if (_progressOffset > _progressTrack.Width - _progressFill.Width)
                {
                    _progressOffset = _progressTrack.Width - _progressFill.Width;
                    _progressDirection = -1;
                }
                else if (_progressOffset < 0)
                {
                    _progressOffset = 0;
                    _progressDirection = 1;
                }

                _progressFill.Left = _progressOffset;
            };
            _progressTimer.Start();

            Shown += OnFirstShown;
            FormClosing += OnFormClosing;
        }

        private void CenterSplashCard()
        {
            if (_splash == null || _splashCard == null)
            {
                return;
            }

            int left = Math.Max(0, (_splash.ClientSize.Width - _splashCard.Width) / 2);
            int top = Math.Max(0, (_splash.ClientSize.Height - _splashCard.Height) / 2);
            _splashCard.Location = new Point(left, top);
        }

        private async void OnFirstShown(object sender, EventArgs e)
        {
            if (_startupStarted)
            {
                return;
            }
            _startupStarted = true;

            try
            {
                UpdateStatus("正在检查运行环境…");
                await Task.Delay(150);

                CheckPrerequisites();
                PrepareDatabase();

                UpdateStatus("正在启动本地服务…");
                _serverPort = FindFreePort();
                _appUrl = "http://127.0.0.1:" + _serverPort + "/";
                StartServer(_serverPort);
                await WaitForServerAsync(_appUrl, 45000);

                if (_shuttingDown || IsDisposed)
                {
                    return;
                }

                UpdateStatus("正在初始化应用窗口…");
                await InitializeWebViewAsync();
                if (_shuttingDown || IsDisposed)
                {
                    return;
                }

                UpdateStatus("正在载入 BanLog…");
                // WebView2 只能在可见状态下可靠导航；在完成初始化后再
                // 移除启动画面，避免原生子窗口与 WinForms 遮罩发生
                // airspace 叠加问题。
                _splash.Visible = false;
                _webView.Visible = true;
                _webView.CoreWebView2.Navigate(_appUrl);
            }
            catch (OperationCanceledException)
            {
                // Window was closed while starting.
            }
            catch (Exception ex)
            {
                if (_shuttingDown || IsDisposed)
                {
                    return;
                }

                LauncherEnvironment.Log("Startup failed: " + ex);
                ShowFatalError(
                    "BanLog 启动失败",
                    ex.Message +
                    "\r\n\r\n启动日志：" + LauncherEnvironment.GetLogPath("launcher.log") +
                    "\r\n服务日志：" + LauncherEnvironment.GetLogPath("server.log"));
            }
        }

        private void CheckPrerequisites()
        {
            if (!File.Exists(LauncherEnvironment.NodePath))
            {
                throw new FileNotFoundException(
                    "找不到内置 Node 运行环境。请确认 runtime\\node.exe 未丢失。",
                    LauncherEnvironment.NodePath);
            }

            if (!File.Exists(LauncherEnvironment.ServerEntry))
            {
                throw new FileNotFoundException(
                    "找不到应用服务文件。请确认 server\\server.js 未丢失。",
                    LauncherEnvironment.ServerEntry);
            }

            if (!File.Exists(LauncherEnvironment.SeedPath))
            {
                throw new FileNotFoundException(
                    "找不到数据库初始化模板 seed.db。",
                    LauncherEnvironment.SeedPath);
            }
        }

        private void PrepareDatabase()
        {
            if (!File.Exists(LauncherEnvironment.DatabasePath))
            {
                File.Copy(LauncherEnvironment.SeedPath, LauncherEnvironment.DatabasePath);
                LauncherEnvironment.Log(
                    "Created database from seed: " + LauncherEnvironment.DatabasePath);
            }
        }

        private static int FindFreePort()
        {
            TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            try
            {
                IPEndPoint endpoint = (IPEndPoint)listener.LocalEndpoint;
                return endpoint.Port;
            }
            finally
            {
                listener.Stop();
            }
        }

        private void StartServer(int port)
        {
            _serverLogClosed = false;
            _serverLogWriter = new StreamWriter(
                LauncherEnvironment.GetLogPath("server.log"),
                true,
                new UTF8Encoding(false));
            _serverLogWriter.AutoFlush = true;

            WriteServerLog(
                "Starting desktop server. node=" + LauncherEnvironment.NodePath +
                " server=" + LauncherEnvironment.ServerEntry +
                " port=" + port);

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = LauncherEnvironment.NodePath;
            info.Arguments = QuoteArgument(LauncherEnvironment.ServerEntry);
            info.WorkingDirectory = LauncherEnvironment.ServerDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.StandardOutputEncoding = new UTF8Encoding(false);
            info.StandardErrorEncoding = new UTF8Encoding(false);

            CopyEnvironment(info, port);

            Process process = new Process();
            process.StartInfo = info;
            process.EnableRaisingEvents = true;
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args)
            {
                if (args.Data != null)
                {
                    WriteServerLog("[out] " + args.Data);
                }
            };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args)
            {
                if (args.Data != null)
                {
                    WriteServerLog("[err] " + args.Data);
                }
            };
            process.Exited += delegate
            {
                if (_shuttingDown)
                {
                    return;
                }

                try
                {
                    if (IsHandleCreated && !IsDisposed)
                    {
                        BeginInvoke(new MethodInvoker(delegate
                        {
                            HandleUnexpectedServerExit();
                        }));
                    }
                }
                catch
                {
                    // Window may be closing.
                }
            };

            if (!process.Start())
            {
                throw new InvalidOperationException("无法启动本地 Node 服务。");
            }

            _serverProcess = process;
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            LauncherEnvironment.Log(
                "Node server started (PID " + process.Id + ", port " + port + ").");
        }

        private static void CopyEnvironment(ProcessStartInfo info, int port)
        {
            foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
            {
                string key = entry.Key as string;
                string value = entry.Value as string;
                if (key != null && value != null)
                {
                    info.EnvironmentVariables[key] = value;
                }
            }

            string databaseUrl =
                "file:" + LauncherEnvironment.DatabasePath.Replace("\\", "/");

            info.EnvironmentVariables["PORT"] = port.ToString();
            info.EnvironmentVariables["HOSTNAME"] = "127.0.0.1";
            info.EnvironmentVariables["DATABASE_URL"] = databaseUrl;
            info.EnvironmentVariables["NODE_ENV"] = "production";
            info.EnvironmentVariables["NEXT_TELEMETRY_DISABLED"] = "1";
            info.EnvironmentVariables["BANLOG_CHINESE_MAP_PATH"] = Path.Combine(
                LauncherEnvironment.BaseDir,
                "data",
                "anilist-chinese.json");
        }

        private async Task WaitForServerAsync(string url, int timeoutMs)
        {
            Process process = _serverProcess;
            if (process == null)
            {
                throw new InvalidOperationException("本地服务没有启动。");
            }

            DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline)
            {
                if (_shuttingDown)
                {
                    throw new OperationCanceledException();
                }

                if (process.HasExited)
                {
                    throw new InvalidOperationException(
                        "本地服务提前退出，退出码 " + process.ExitCode +
                        "。请查看日志：" + LauncherEnvironment.GetLogPath("server.log"));
                }

                bool ready = await Task.Run(new Func<bool>(delegate
                {
                    return CheckHttpReady(url);
                }));

                if (ready)
                {
                    LauncherEnvironment.Log("Server is ready at " + url);
                    return;
                }

                await Task.Delay(300);
            }

            throw new TimeoutException(
                "本地服务启动超时。请查看日志：" +
                LauncherEnvironment.GetLogPath("server.log"));
        }

        private static bool CheckHttpReady(string url)
        {
            HttpWebRequest request = null;
            WebResponse response = null;

            try
            {
                request = (HttpWebRequest)WebRequest.Create(url);
                request.Proxy = null;
                request.Timeout = 1500;
                request.ReadWriteTimeout = 1500;
                response = request.GetResponse();
                HttpWebResponse httpResponse = response as HttpWebResponse;
                return httpResponse != null && (int)httpResponse.StatusCode == 200;
            }
            catch
            {
                return false;
            }
            finally
            {
                if (response != null)
                {
                    response.Close();
                }
            }
        }

        private async Task InitializeWebViewAsync()
        {
            string additionalArguments = string.Empty;
            if (LauncherEnvironment.DebugMode)
            {
                additionalArguments =
                    "--remote-debugging-port=" + LauncherEnvironment.DebugPort +
                    " --remote-allow-origins=*";
            }

            CoreWebView2EnvironmentOptions options =
                new CoreWebView2EnvironmentOptions(additionalArguments);

            CoreWebView2Environment environment =
                await CoreWebView2Environment.CreateAsync(
                    null,
                    LauncherEnvironment.WebViewDataDir,
                    options);

            await _webView.EnsureCoreWebView2Async(environment);

            CoreWebView2 core = _webView.CoreWebView2;
            if (core == null)
            {
                throw new InvalidOperationException("WebView2 初始化失败。");
            }

            core.Settings.AreDevToolsEnabled = LauncherEnvironment.DebugMode;
            core.Settings.AreDefaultContextMenusEnabled = LauncherEnvironment.DebugMode;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;

            core.NewWindowRequested += OnNewWindowRequested;
            core.NavigationCompleted += OnNavigationCompleted;
            core.DocumentTitleChanged += OnDocumentTitleChanged;
            core.ProcessFailed += OnWebViewProcessFailed;

            LauncherEnvironment.Log(
                "WebView2 ready. Runtime version=" + environment.BrowserVersionString);
        }

        private void OnNavigationCompleted(
            object sender,
            CoreWebView2NavigationCompletedEventArgs e)
        {
            if (_shuttingDown || IsDisposed)
            {
                return;
            }

            if (!e.IsSuccess)
            {
                LauncherEnvironment.Log(
                    "Navigation failed. Error=" + e.WebErrorStatus);
                ShowFatalError(
                    "无法载入应用界面",
                    "本地页面加载失败（" + e.WebErrorStatus +
                    "）。\r\n\r\n服务日志：" +
                    LauncherEnvironment.GetLogPath("server.log"));
                return;
            }

            _progressTimer.Stop();
            _webView.Visible = true;
            _splash.Visible = false;
            _webView.Focus();
            Activate();
            LauncherEnvironment.Log("Application page loaded: " + _appUrl);
        }

        private void OnDocumentTitleChanged(object sender, object e)
        {
            try
            {
                string documentTitle = _webView.CoreWebView2.DocumentTitle;
                if (!string.IsNullOrWhiteSpace(documentTitle))
                {
                    bool hasBrand = documentTitle.IndexOf(
                        "BanLog",
                        StringComparison.OrdinalIgnoreCase) >= 0;
                    Text = hasBrand ? documentTitle : documentTitle + " · BanLog";
                }
            }
            catch
            {
                // Ignore title update race during close.
            }
        }

        private void OnNewWindowRequested(
            object sender,
            CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            string uri = e.Uri;
            if (string.IsNullOrWhiteSpace(uri))
            {
                return;
            }

            try
            {
                Uri parsed = new Uri(uri);
                if (parsed.Scheme == Uri.UriSchemeHttp ||
                    parsed.Scheme == Uri.UriSchemeHttps)
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = uri,
                        UseShellExecute = true
                    });
                }
            }
            catch
            {
                // Ignore malformed external URLs.
            }
        }

        private void OnWebViewProcessFailed(
            object sender,
            CoreWebView2ProcessFailedEventArgs e)
        {
            if (_shuttingDown)
            {
                return;
            }

            LauncherEnvironment.Log(
                "WebView2 process failed: " + e.ProcessFailedKind);
            if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
            {
                try
                {
                    if (IsHandleCreated && !IsDisposed)
                    {
                        BeginInvoke(new MethodInvoker(delegate
                        {
                            ShowFatalError(
                                "应用界面异常退出",
                                "WebView2 浏览器进程已退出。请重新启动 BanLog。");
                        }));
                    }
                }
                catch
                {
                    // Ignore close races.
                }
            }
        }

        private void HandleUnexpectedServerExit()
        {
            if (_shuttingDown || _fatalErrorShown)
            {
                return;
            }

            int exitCode = -1;
            try
            {
                if (_serverProcess != null)
                {
                    exitCode = _serverProcess.ExitCode;
                }
            }
            catch
            {
                // Ignore.
            }

            WriteServerLog("Server exited unexpectedly with code " + exitCode + ".");
            ShowFatalError(
                "本地服务意外退出",
                "退出码：" + exitCode +
                "\r\n\r\n服务日志：" + LauncherEnvironment.GetLogPath("server.log"));
        }

        private void ShowFatalError(string title, string message)
        {
            if (_fatalErrorShown || _shuttingDown)
            {
                return;
            }

            _fatalErrorShown = true;
            _progressTimer.Stop();
            UpdateStatus("启动失败");

            try
            {
                MessageBox.Show(
                    message,
                    title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
            catch
            {
                // Ignore.
            }

            Close();
        }

        private void UpdateStatus(string text)
        {
            if (_statusLabel != null && !_statusLabel.IsDisposed)
            {
                _statusLabel.Text = text;
            }
        }

        private void WriteServerLog(string line)
        {
            lock (_serverLogLock)
            {
                if (_serverLogClosed || _serverLogWriter == null)
                {
                    return;
                }

                try
                {
                    _serverLogWriter.WriteLine(
                        "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + line);
                }
                catch
                {
                    // Ignore close races.
                }
            }
        }

        private void CloseServerLog()
        {
            lock (_serverLogLock)
            {
                if (_serverLogClosed)
                {
                    return;
                }

                _serverLogClosed = true;
                if (_serverLogWriter != null)
                {
                    try
                    {
                        _serverLogWriter.Flush();
                        _serverLogWriter.Close();
                    }
                    catch
                    {
                        // Ignore.
                    }
                    _serverLogWriter = null;
                }
            }
        }

        private void StopServer()
        {
            Process process = _serverProcess;
            _serverProcess = null;
            if (process != null)
            {
                try
                {
                    if (!process.HasExited)
                    {
                        process.Kill();
                        process.WaitForExit(3000);
                    }
                }
                catch
                {
                    // Ignore.
                }
                finally
                {
                    try
                    {
                        process.Dispose();
                    }
                    catch
                    {
                        // Ignore.
                    }
                }
            }

            CloseServerLog();
            LauncherEnvironment.Log("Node server stopped.");
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (_shuttingDown)
            {
                return;
            }

            _shuttingDown = true;
            _progressTimer.Stop();

            try
            {
                if (_webView != null)
                {
                    _webView.Visible = false;
                }
            }
            catch
            {
                // Ignore.
            }

            StopServer();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_progressTimer != null)
                {
                    _progressTimer.Dispose();
                }
                if (_webView != null)
                {
                    try
                    {
                        _webView.Dispose();
                    }
                    catch
                    {
                        // Ignore.
                    }
                }
            }

            base.Dispose(disposing);
        }

        private static string QuoteArgument(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
    }
}
