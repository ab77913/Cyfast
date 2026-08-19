namespace CyFast.Windows.TestFixture;

public partial class Form1 : Form
{
    public Form1()
    {
        Name = "CyFastFixture.Main";
        AccessibleName = "CyFastFixture.Main";
        Text = "CyFAST UIA Fixture";
        Width = 560;
        Height = 500;
        var text = new TextBox { Name = "CyFastFixture.TextInput", AccessibleName = "CyFastFixture.TextInput", Top = 20, Left = 20, Width = 300 };
        var password = new TextBox { Name = "CyFastFixture.PasswordInput", AccessibleName = "CyFastFixture.PasswordInput", Top = 55, Left = 20, Width = 300, UseSystemPasswordChar = true };
        var status = new Label { Name = "CyFastFixture.StatusLabel", Top = 95, Left = 20, Width = 300, Text = "Ready" };
        var action = new Button { Name = "CyFastFixture.ActionButton", AccessibleName = "CyFastFixture.ActionButton", Text = "Action", Top = 125, Left = 20 };
        action.Click += (_, _) => status.Text = $"OK:{text.Text}";
        var check = new CheckBox { Name = "CyFastFixture.CheckBox", AccessibleName = "CyFastFixture.CheckBox", Text = "Check", Top = 125, Left = 120 };
        var combo = new ComboBox { Name = "CyFastFixture.ComboBox", AccessibleName = "CyFastFixture.ComboBox", Top = 160, Left = 20, Width = 160 };
        combo.Items.AddRange(["One", "Two", "Three"]);
        var list = new ListBox { Name = "CyFastFixture.ListBox", AccessibleName = "CyFastFixture.ListBox", Top = 195, Left = 20, Width = 160 };
        list.Items.AddRange(["Alpha", "Beta", "Gamma"]);
        var openDialog = new Button { Name = "CyFastFixture.OpenDialog", AccessibleName = "CyFastFixture.OpenDialog", Text = "Dialog", Top = 160, Left = 200 };
        openDialog.Click += (_, _) => BeginInvoke(() =>
        {
            using var dialog = new Form { Name = "CyFastFixture.Modal", AccessibleName = "CyFastFixture.Modal", Text = "CyFAST Modal", Width = 250, Height = 150 };
            dialog.ShowDialog(this);
        });
        var disabled = new Button { Name = "CyFastFixture.DisabledButton", AccessibleName = "CyFastFixture.DisabledButton", Text = "Disabled", Top = 195, Left = 200, Enabled = false };
        var dynamic = new Button { Name = "CyFastFixture.DynamicControl", AccessibleName = "CyFastFixture.DynamicControl", Text = "Dynamic", Top = 230, Left = 20, Visible = false };
        var showDynamic = new Button { Name = "CyFastFixture.ShowDynamic", AccessibleName = "CyFastFixture.ShowDynamic", Text = "Show dynamic", Top = 230, Left = 120 };
        showDynamic.Click += (_, _) => { _ = Task.Delay(250).ContinueWith(_ => BeginInvoke(dynamic.Show)); };
        var scroll = new Panel { Name = "CyFastFixture.ScrollPanel", AccessibleName = "CyFastFixture.ScrollPanel", AutoScroll = true, Top = 270, Left = 20, Width = 350, Height = 100 };
        scroll.Controls.Add(new Label { Text = "Scrollable fixture content", Top = 130, Width = 250 });
        var close = new Button { Name = "CyFastFixture.CloseButton", AccessibleName = "CyFastFixture.CloseButton", Text = "Close", Top = 390, Left = 20 };
        close.Click += (_, _) => Close();
        Controls.AddRange([text, password, status, action, check, combo, list, openDialog, disabled, dynamic, showDynamic, scroll, close]);
    }
}
